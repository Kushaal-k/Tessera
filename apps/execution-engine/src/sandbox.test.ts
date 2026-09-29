import { describe, expect, it } from "vitest";
import tar from "tar-stream";
import { demuxDockerStream, createWorkspaceArchive } from "./sandbox.js";

const STREAM_STDOUT = 1;
const STREAM_STDERR = 2;

/** Build a single Docker multiplexed-stream frame (8-byte header + payload). */
function frame(streamType: number, text: string): Buffer {
  const payload = Buffer.from(text, "utf-8");
  const header = Buffer.alloc(8);
  header[0] = streamType;
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

describe("demuxDockerStream", () => {
  it("returns empty streams for an empty buffer", () => {
    expect(demuxDockerStream(Buffer.alloc(0))).toEqual({ stdout: "", stderr: "" });
  });

  it("strips the 8-byte header that the old raw read leaked into the output", () => {
    const framed = frame(STREAM_STDOUT, "Hello World\n");

    expect(framed.toString("utf-8")).not.toBe("Hello World\n");
    expect(framed.toString("utf-8").charCodeAt(0)).toBe(STREAM_STDOUT);
    expect(demuxDockerStream(framed)).toEqual({ stdout: "Hello World\n", stderr: "" });
  });

  it("separates stdout and stderr frames", () => {
    const buffer = Buffer.concat([
      frame(STREAM_STDOUT, "out line 1\n"),
      frame(STREAM_STDERR, "err line\n"),
      frame(STREAM_STDOUT, "out line 2\n"),
    ]);

    expect(demuxDockerStream(buffer)).toEqual({
      stdout: "out line 1\nout line 2\n",
      stderr: "err line\n",
    });
  });

  it("concatenates multiple frames of the same stream in order", () => {
    const buffer = Buffer.concat([
      frame(STREAM_STDOUT, "a"),
      frame(STREAM_STDOUT, "b"),
      frame(STREAM_STDOUT, "c"),
    ]);

    expect(demuxDockerStream(buffer).stdout).toBe("abc");
  });

  it("preserves multi-byte UTF-8 payloads split correctly by byte length", () => {
    const text = "café — 日本語\n";
    expect(demuxDockerStream(frame(STREAM_STDOUT, text)).stdout).toBe(text);
  });

  it("falls back to stdout for a non-multiplexed (raw/TTY) buffer", () => {
    // A raw TTY stream has no frame headers; the first byte is real content,
    // not a 0-2 stream type. It must be returned intact as stdout, not dropped.
    const raw = Buffer.from("plain tty output\n", "utf-8");
    expect(demuxDockerStream(raw)).toEqual({ stdout: "plain tty output\n", stderr: "" });
  });

  it("does not drop a truncated trailing frame", () => {
    const truncated = Buffer.concat([
      frame(STREAM_STDOUT, "complete\n"),
      Buffer.from([STREAM_STDOUT, 0, 0]), // partial header, < 8 bytes
    ]);

    const { stdout } = demuxDockerStream(truncated);
    expect(stdout.startsWith("complete\n")).toBe(true);
  });
});

describe("createWorkspaceArchive", () => {
  it("packs multiple files into a valid tarball buffer with normalized paths", async () => {
    const files = [
      { path: "main.py", content: "print('hello')" },
      { path: "utils/helper.py", content: "def add(a, b): return a + b" },
      { path: "/src/index.ts", content: "console.log('hi');" },
    ];

    const buffer = await createWorkspaceArchive(files);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const extract = tar.extract();
    const extractedEntries: Array<{ name: string; content: string }> = [];

    const promise = new Promise<void>((resolve, reject) => {
      extract.on("entry", (header, stream, next) => {
        const chunks: Buffer[] = [];
        stream.on("data", (c) => {
          chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as Uint8Array));
        });
        stream.on("end", () => {
          extractedEntries.push({
            name: header.name,
            content: Buffer.concat(chunks).toString("utf-8"),
          });
          next();
        });
        stream.on("error", reject);
      });
      extract.on("finish", resolve);
      extract.on("error", reject);
    });

    extract.end(buffer);
    await promise;

    expect(extractedEntries).toHaveLength(3);
    expect(extractedEntries).toEqual([
      { name: "main.py", content: "print('hello')" },
      { name: "utils/helper.py", content: "def add(a, b): return a + b" },
      { name: "src/index.ts", content: "console.log('hi');" },
    ]);
  });
});

