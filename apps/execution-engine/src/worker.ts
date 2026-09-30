import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { ExecutionTask, ExecutionResult } from "@tessera/shared-types";
import { executeInSandbox } from "./sandbox.js";
import { QUEUE_NAME, createRedisConnectionOptions } from "./queue.js";
import { startServer } from "./server.js";

const connection = createRedisConnectionOptions();

const worker = new Worker<ExecutionTask, ExecutionResult>(
  QUEUE_NAME,
  async (job: Job<ExecutionTask>): Promise<ExecutionResult> => {
    console.log(`processing job ${job.id ?? "unknown"} [lang=${job.data.language}]`);
    const sandboxPromise = executeInSandbox(job.data);
    const hangTimeout = job.data.timeoutMs + 30_000;
    let timerId: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => reject(new Error("Sandbox hung indefinitely")), hangTimeout);
    });
    return Promise.race([sandboxPromise, timeout]).finally(() => clearTimeout(timerId));
  },
  {
    connection,
    concurrency: Number(process.env["WORKER_CONCURRENCY"] ?? 3),
    lockDuration: 60000,
    stalledInterval: 30000,
    maxStalledCount: 3,
  },
);

worker.on("completed", (job, result) => {
  console.log(`job ${job.id ?? "unknown"} completed [status=${result.status}, duration=${String(result.durationMs)}ms]`);
});

worker.on("failed", (job, err) => {
  console.error(`job ${job?.id ?? "unknown"} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("worker error:", err.message);
});

console.log(`worker listening on queue: ${QUEUE_NAME}`);

const serverPromise = startServer().catch((err: unknown) => {
  console.error("[execution-engine] Failed to start terminal server:", err);
  return null;
})

async function gracefulShutdown(): Promise<void> {
  console.log("shutting down worker and gateway…");
  const server = await serverPromise;

  if (server) {
    await server.stop();
  }
  void worker.close().then(() => process.exit(0));
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
