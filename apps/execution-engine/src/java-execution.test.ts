import { vi, describe, expect, it, beforeEach } from "vitest";

// Shared reference object to control mock behavior dynamically per test
const mockState = {
  exitCode: 0,
  logsBuffer: Buffer.alloc(0) as any,
  waitDelayMs: 0,
};

// Mock Dockerode at module level before importing sandbox
vi.mock("dockerode", () => {
  return {
    default: class MockDockerode {
      getImage() {
        return {
          inspect() {
            return Promise.resolve({});
          },
        };
      }
      async createContainer() {
        return {
          async start() {},
          wait() {
            if (mockState.waitDelayMs > 0) {
              return new Promise((resolve) => setTimeout(resolve, mockState.waitDelayMs));
            }
            return Promise.resolve({ StatusCode: mockState.exitCode });
          },
          logs() {
            return Promise.resolve(mockState.logsBuffer);
          },
          inspect() {
            return Promise.resolve({ State: { ExitCode: mockState.exitCode } });
          },
          async stop() {},
          async remove() {},
        };
      }
    },
  };
});

import { executeInSandbox } from "./sandbox.js";

// Helper to build Docker multiplexed stream frames (matches logic in sandbox.test.ts)
function frame(streamType: number, text: string): Buffer {
  const payload = Buffer.from(text, "utf-8");
  const header = Buffer.alloc(8);
  header[0] = streamType;
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

describe("Java E2E execution tests", () => {
  beforeEach(() => {
    // Reset mock state before each test
    mockState.exitCode = 0;
    mockState.logsBuffer = Buffer.alloc(0);
    mockState.waitDelayMs = 0;
  });

  it("verifies successful execution of a valid Java program", async () => {
    mockState.exitCode = 0;
    mockState.logsBuffer = frame(1, "Hello, Java!\n"); // Stream 1 = stdout

    const task = {
      id: "java-success-task",
      roomId: "test-room",
      language: "java" as const,
      code: 'public class Main { public static void main(String[] args) { System.out.println("Hello, Java!"); } }',
      timeoutMs: 2000,
      createdAt: new Date().toISOString(),
    };

    const result = await executeInSandbox(task);

    expect(result.taskId).toBe(task.id);
    expect(result.status).toBe("completed");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Hello, Java!\n");
    expect(result.stderr).toBe("");
  });

  it("verifies failure handling for invalid Java code", async () => {
    mockState.exitCode = 1;
    mockState.logsBuffer = frame(2, "Main.java:3: error: ';' expected\n"); // Stream 2 = stderr

    const task = {
      id: "java-failed-task",
      roomId: "test-room",
      language: "java" as const,
      code: 'public class Main { public static void main(String[] args) { System.out.println("Invalid code") } }',
      timeoutMs: 2000,
      createdAt: new Date().toISOString(),
    };

    const result = await executeInSandbox(task);

    expect(result.taskId).toBe(task.id);
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Main.java:3: error: ';' expected\n");
  });

  it("verifies the correct status is returned for a timeout", async () => {
    mockState.exitCode = 0;
    mockState.waitDelayMs = 1000; // Force wait promise to resolve slowly

    const task = {
      id: "java-timeout-task",
      roomId: "test-room",
      language: "java" as const,
      code: "public class Main { public static void main(String[] args) { while (true) {} } }",
      timeoutMs: 100, // short timeout triggers timeout branch
      createdAt: new Date().toISOString(),
    };

    const result = await executeInSandbox(task);

    expect(result.taskId).toBe(task.id);
    expect(result.status).toBe("timeout");
    expect(result.exitCode).toBeNull();
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Execution timed out after 100ms");
  });
});
