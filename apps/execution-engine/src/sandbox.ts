import Dockerode from "dockerode";
import type {
  ExecutionTask,
  ExecutionResult,
  SandboxConfig,
  SupportedLanguage,
} from "@tessera/shared-types";

const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });

/** Cleanly separated output streams parsed from a Docker log buffer. */
export interface DemuxedStreams {
  stdout: string;
  stderr: string;
}

// Docker multiplexes stdout/stderr into a single stream when a container runs
// without a TTY (`Tty: false`, our default). Every payload chunk is prefixed with
// an 8-byte header: byte 0 is the stream type (0 = stdin, 1 = stdout, 2 = stderr),
// bytes 1-3 are zero padding, and bytes 4-7 are the payload length as a big-endian
// uint32. See https://docs.docker.com/engine/api/v1.43/#tag/Container/operation/ContainerAttach
const STREAM_HEADER_SIZE = 8;
const STREAM_TYPE_STDERR = 2;

/**
 * Parse a multiplexed Docker log buffer into separate `stdout` and `stderr`
 * strings, stripping the 8-byte frame headers. If the buffer is not multiplexed
 * (for example a raw stream from a TTY-allocated container), the bytes are
 * returned as `stdout` rather than being corrupted or dropped.
 */
export function demuxDockerStream(buffer: Buffer): DemuxedStreams {
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let offset = 0;

  while (offset + STREAM_HEADER_SIZE <= buffer.length) {
    const streamType = buffer[offset];
    const payloadLength = buffer.readUInt32BE(offset + 4);
    const payloadStart = offset + STREAM_HEADER_SIZE;
    const payloadEnd = payloadStart + payloadLength;

    // A valid frame has a known stream type (0-2) and a length that stays within
    // the buffer. Anything else means this isn't a multiplexed stream, so treat
    // the remaining bytes as stdout instead of emitting garbage.
    if (streamType === undefined || streamType > STREAM_TYPE_STDERR || payloadEnd > buffer.length) {
      stdoutChunks.push(buffer.subarray(offset));
      return joinStreams(stdoutChunks, stderrChunks);
    }

    const payload = buffer.subarray(payloadStart, payloadEnd);
    (streamType === STREAM_TYPE_STDERR ? stderrChunks : stdoutChunks).push(payload);
    offset = payloadEnd;
  }

  // Trailing bytes too short to form a header shouldn't occur for a well-formed
  // stream, but keep them (as stdout) rather than silently dropping output.
  if (offset < buffer.length) {
    stdoutChunks.push(buffer.subarray(offset));
  }

  return joinStreams(stdoutChunks, stderrChunks);
}

function joinStreams(stdoutChunks: Buffer[], stderrChunks: Buffer[]): DemuxedStreams {
  return {
    stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
    stderr: Buffer.concat(stderrChunks).toString("utf-8"),
  };
}

const LANGUAGE_IMAGES: Record<SupportedLanguage, string> = {
  typescript: "node:20-slim",
  python: "python:3.12-slim",
  cpp: "gcc:14",
  java: "eclipse-temurin:21-jdk-alpine",
  rust: "rust:1.75-slim",
  go: "golang:1.20-alpine",
};

const LANGUAGE_COMMANDS: Record<
  SupportedLanguage,
  (code: string) => string[]
> = {
  typescript: (code) => ["node", "--input-type=module", "-e", code],
  python: (code) => ["python3", "-c", code],
  cpp: (code) => ["sh", "-c", `echo '${code.replace(/'/g, "'\\''")}' > /tmp/main.cpp && g++ -o /tmp/main /tmp/main.cpp && /tmp/main`],
  java: (code) => ["sh", "-c", `echo '${code.replace(/'/g, "'\\''")}' > /tmp/Main.java && javac /tmp/Main.java -d /tmp && java -cp /tmp Main`],
  rust: (code) => ["sh", "-c", `echo '${code.replace(/'/g, "'\\''")}' > /tmp/main.rs && rustc /tmp/main.rs -o /tmp/main && /tmp/main`],
  go: (code) => [
  "sh",
  "-c",
  `echo '${code.replace(/'/g, "'\\''")}' > /tmp/main.go && go run /tmp/main.go`,
],
};

const DEFAULT_MEMORY_LIMIT_MB = 256;

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  runtime: "runc",
  memoryLimitMb: DEFAULT_MEMORY_LIMIT_MB,
  cpuQuota: 100000,
  networkDisabled: true,
};

function detectRuntime(): SandboxConfig["runtime"] {
  return process.env["SANDBOX_RUNTIME"] === "runsc" ? "runsc" : "runc";
}

function detectMemoryLimit(): number {
  const value = process.env["SANDBOX_MEMORY_LIMIT"];
  if (!value) return DEFAULT_MEMORY_LIMIT_MB;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MEMORY_LIMIT_MB;
}

async function ensureImageExists(image: string): Promise<void> {
  try {
    await docker.getImage(image).inspect();
  } catch {
    console.log(`[sandbox] pulling docker image: ${image} (this might take a moment)...`);
    const stream = await docker.pull(image);
    await new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(stream, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log(`[sandbox] successfully pulled image: ${image}`);
  }
}

/**
 * Parses and formats raw g++ compiler error logs into clean, boxed visual frames.
 */
export function formatCppCompilerErrors(rawLogs: string): string {
  const cleanedLogs = rawLogs.replace(/[\u0000-\u0002]\u0000\u0000\u0000[\s\S]{4}/g, "");

  const lines = cleanedLogs.split("\n");
  const result: string[] = [];
  let isBlockOpen = false;

  const closeBlock = () => {
    if (isBlockOpen) {
      result.push("└" + "─".repeat(78));
      result.push("");
      isBlockOpen = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    const trimmedLine = line.trim();
    const errorRegex = /^\/tmp\/main\.cpp:(\d+):(\d+):\s*(error|warning|note):\s*(.*)$/i;
    const errorMatch = line.match(errorRegex);

    if (errorMatch) {
      closeBlock();

      const lineNum = errorMatch[1] ?? "";
      const colNum = errorMatch[2] ?? "";
      const severity = errorMatch[3] ?? "";
      const message = errorMatch[4] ?? "";

      let label = "❌ ERROR";
      if (severity.toLowerCase() === "warning") {
        label = "⚠️ WARNING";
      } else if (severity.toLowerCase() === "note") {
        label = "ℹ️ NOTE";
      }

      const headerText = `── ${label} (Line ${lineNum}, Col ${colNum}) `;
      const fillLength = Math.max(2, 80 - headerText.length);

      result.push(`┌${headerText}${"─".repeat(fillLength)}`);
      result.push(`│  Message: ${message}`);
      result.push(`│`);
      isBlockOpen = true;
      continue;
    }

    const contextRegex = /^\/tmp\/main\.cpp:\s*In\s+function\s+['"](.*)['"]\s*:/i;
    const contextMatch = line.match(contextRegex);
    if (contextMatch) {
      closeBlock();
      const functionName = contextMatch[1] ?? "unknown";
      result.push(`👉 In function '${functionName}':`);
      result.push("");
      continue;
    }

    if (isBlockOpen) {
      if (trimmedLine === "") {
        result.push("│");
        continue;
      }

      const cleanedLine = line.replace(/\/tmp\/main\.cpp/g, "main.cpp");
      const isCodeOrPointerLine = /^\s*\d*\s*\|/i.test(cleanedLine);

      if (isCodeOrPointerLine) {
        result.push(`│  ${cleanedLine.trimEnd()}`);
      } else {
        result.push(`│  ${cleanedLine}`);
      }
    } else {
      if (trimmedLine !== "") {
        result.push(line.replace(/\/tmp\/main\.cpp/g, "main.cpp"));
      }
    }
  }

  closeBlock();

  while (result.length > 0 && result[result.length - 1] === "") {
    result.pop();
  }

  return result.join("\n");
}

export async function executeInSandbox(
  task: ExecutionTask
): Promise<ExecutionResult> {
  const startTime = performance.now();

  const config: SandboxConfig = {
    ...DEFAULT_SANDBOX_CONFIG,
    runtime: detectRuntime(),
    memoryLimitMb: detectMemoryLimit(),
  };

  const image = LANGUAGE_IMAGES[task.language];
  const cmd = LANGUAGE_COMMANDS[task.language](task.code);

  let container: Dockerode.Container | undefined;

  try {
    await ensureImageExists(image);

    container = await docker.createContainer({
      Image: image,
      Cmd: cmd,
      User: "1000",
      WorkingDir: "/tmp",
      HostConfig: {
        Runtime: config.runtime,
        Memory: config.memoryLimitMb * 1024 * 1024,
        CpuQuota: config.cpuQuota,
        NetworkMode: config.networkDisabled ? "none" : "bridge",
        CapDrop: ["ALL"],
        ReadonlyRootfs: true,
        SecurityOpt: ["no-new-privileges:true"],
        Tmpfs: { "/tmp": "size=64M,nosuid" },
        AutoRemove: false,
      },
      NetworkDisabled: config.networkDisabled,
      StopTimeout: Math.ceil(task.timeoutMs / 1000),
    });
    console.log(`[sandbox] container created: ${container.id} | language: ${task.language} | taskId: ${task.id}`);

    await container.start();
    console.log(`[sandbox] container started: ${container.id} | timeout: ${task.timeoutMs}ms`);

    const timeoutPromise = new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), task.timeoutMs);
    });

    const waitPromise = container.wait();
    const race = await Promise.race([waitPromise, timeoutPromise]);

    if (race === "timeout") {
      console.log(`[sandbox] container timed out: ${container.id} | taskId: ${task.id}`);
      try {
        await container.stop({ t: 1 });
      } catch {
        // Container already terminated
      }
      return {
        taskId: task.id,
        status: "timeout",
        stdout: "",
        stderr: `Execution timed out after ${String(task.timeoutMs)}ms`,
        exitCode: null,
        durationMs: performance.now() - startTime,
      };
    }

    const logs = await container.logs({ stdout: true, stderr: true, follow: false });
    const logBuffer = Buffer.isBuffer(logs) ? logs : Buffer.from(logs as unknown as string, "utf-8");
    const { stdout, stderr } = demuxDockerStream(logBuffer);

    const inspectInfo = await container.inspect();
    const exitCode = inspectInfo.State.ExitCode as number;
    console.log(`[sandbox] container completed: ${container.id} | exitCode: ${exitCode} | duration: ${(performance.now() - startTime).toFixed(2)}ms`);

    const formattedStderr =
      task.language === "cpp" && exitCode !== 0
        ? formatCppCompilerErrors(stderr)
        : stderr;

    return {
      taskId: task.id,
      status: exitCode === 0 ? "completed" : "failed",
      stdout,
      stderr: formattedStderr,
      exitCode,
      durationMs: performance.now() - startTime,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      taskId: task.id,
      status: "failed",
      stdout: "",
      stderr: message,
      exitCode: null,
      durationMs: performance.now() - startTime,
    };
  } finally {
    if (container) {
      try {
        console.log(`[sandbox] removing container: ${container.id}`);
        await container.remove({ force: true });
        console.log(`[sandbox] container removed: ${container.id}`);
      } catch {
        console.log(`[sandbox] container already removed: ${container.id}`);
      }
    }
  }
}