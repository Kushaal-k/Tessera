import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import http from "node:http";
import { TerminalGateway, type TerminalSocket } from "./terminalGateway.js";
import { createServer } from "./server.js";
import type { TerminalRunner } from "./terminalRunner.js";

class MockSocket extends EventEmitter {
  public id: string;
  public emit = vi.fn();

  constructor(id: string = "socket-1") {
    super();
    this.id = id;
  }

  public simulateClientEvent(event: string, ...args: any[]): void {
    super.emit(event, ...args);
  }
}

function createMockRunner() {
  const runner = {
    createSession: vi.fn(),
    write: vi.fn(),
    resize: vi.fn().mockResolvedValue(undefined),
    killSession: vi.fn().mockResolvedValue(undefined),
    cleanupAll: vi.fn().mockResolvedValue(undefined),
  } as unknown as TerminalRunner;

  return runner;
}

describe("TerminalGateway", () => {
  it("handles terminal:create and wires stream callbacks to socket events", async () => {
    const mockRunner = createMockRunner();
    const gateway = new TerminalGateway({ runner: mockRunner });
    const socket = new MockSocket("socket-1");

    let capturedCallbacks: {
      onData: (data: string) => void;
      onExit: (exitCode: number | null) => void;
    } | null = null;

    vi.mocked(mockRunner.createSession).mockImplementation(
      async (_payload, callbacks) => {
        capturedCallbacks = callbacks;
        return {
          sessionId: "session-123",
          roomId: "room-1",
          container: {} as any,
          exec: {} as any,
          stream: {} as any,
          callback: callbacks,
        };
      }
    );

    gateway.handleConnection(socket as unknown as TerminalSocket);

    socket.simulateClientEvent("terminal:create", {
      sessionId: "session-123",
      roomId: "room-1",
      cols: 80,
      rows: 24,
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(mockRunner.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-123",
        roomId: "room-1",
        cols: 80,
        rows: 24,
      }),
      expect.any(Object)
    );

    expect(socket.emit).toHaveBeenCalledWith("terminal:created", {
      sessionId: "session-123",
    });
    expect(gateway.getSessionIdsForSocket("socket-1")).toContain("session-123");

    expect(capturedCallbacks).not.toBeNull();
    if (capturedCallbacks) {
      const callbacks = capturedCallbacks as {
        onData: (data: string) => void;
        onExit: (exitCode: number | null) => void;
      };

      callbacks.onData("shell output");
      expect(socket.emit).toHaveBeenCalledWith("terminal:output", {
        sessionId: "session-123",
        data: "shell output",
      });

      if ("onFsEvent" in callbacks && typeof (callbacks as any).onFsEvent === "function") {
        (callbacks as any).onFsEvent({
          type: "add",
          path: "src/App.tsx",
          workspaceId: "room-1",
        });
        expect(socket.emit).toHaveBeenCalledWith("terminal:fs-event", {
          type: "add",
          path: "src/App.tsx",
          workspaceId: "room-1",
        });
      }

      callbacks.onExit(0);
      expect(socket.emit).toHaveBeenCalledWith("terminal:exit", {
        sessionId: "session-123",
        exitCode: 0,
      });
      expect(gateway.getSessionIdsForSocket("socket-1")).not.toContain("session-123");
    }
  });

  it("emits terminal:error when terminal:create fails", async () => {
    const mockRunner = createMockRunner();
    const gateway = new TerminalGateway({ runner: mockRunner });
    const socket = new MockSocket("socket-1");

    vi.mocked(mockRunner.createSession).mockRejectedValue(
      new Error("Docker daemon failure")
    );

    gateway.handleConnection(socket as unknown as TerminalSocket);

    socket.simulateClientEvent("terminal:create", {
      sessionId: "failed-session",
      roomId: "room-1",
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
      sessionId: "failed-session",
      error: "Docker daemon failure",
    });
  });

  it("forwards terminal:data to runner.write and emits error on failure", async () => {
    const mockRunner = createMockRunner();
    const gateway = new TerminalGateway({ runner: mockRunner });
    const socket = new MockSocket("socket-1");

    gateway.handleConnection(socket as unknown as TerminalSocket);

    socket.simulateClientEvent("terminal:data", {
      sessionId: "session-123",
      data: "echo hello\n",
    });

    expect(mockRunner.write).toHaveBeenCalledWith("session-123", "echo hello\n");

    vi.mocked(mockRunner.write).mockImplementationOnce(() => {
      throw new Error("Stream closed");
    });

    socket.simulateClientEvent("terminal:data", {
      sessionId: "session-123",
      data: "echo fail\n",
    });

    expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
      sessionId: "session-123",
      error: "Stream closed",
    });
  });

  it("forwards terminal:resize to runner.resize and emits error on failure", async () => {
    const mockRunner = createMockRunner();
    const gateway = new TerminalGateway({ runner: mockRunner });
    const socket = new MockSocket("socket-1");

    gateway.handleConnection(socket as unknown as TerminalSocket);

    socket.simulateClientEvent("terminal:resize", {
      sessionId: "session-123",
      cols: 100,
      rows: 50,
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(mockRunner.resize).toHaveBeenCalledWith("session-123", 100, 50);

    vi.mocked(mockRunner.resize).mockRejectedValueOnce(
      new Error("Resize failed")
    );

    socket.simulateClientEvent("terminal:resize", {
      sessionId: "session-123",
      cols: 120,
      rows: 60,
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
      sessionId: "session-123",
      error: "Resize failed",
    });
  });

  it("handles terminal:kill by calling runner.killSession and untracking", async () => {
    const mockRunner = createMockRunner();
    const gateway = new TerminalGateway({ runner: mockRunner });
    const socket = new MockSocket("socket-1");

    vi.mocked(mockRunner.createSession).mockResolvedValue({
      sessionId: "session-123",
      roomId: "room-1",
      container: {} as any,
      exec: {} as any,
      stream: {} as any,
      callback: { onData: vi.fn(), onExit: vi.fn() },
    });

    gateway.handleConnection(socket as unknown as TerminalSocket);

    socket.simulateClientEvent("terminal:create", {
      sessionId: "session-123",
      roomId: "room-1",
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(gateway.getSessionIdsForSocket("socket-1")).toContain("session-123");

    socket.simulateClientEvent("terminal:kill", { sessionId: "session-123" });

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(mockRunner.killSession).toHaveBeenCalledWith("session-123");
    expect(gateway.getSessionIdsForSocket("socket-1")).not.toContain("session-123");
  });

  it("cleans up all sessions associated with a socket upon disconnect", async () => {
    const mockRunner = createMockRunner();
    const gateway = new TerminalGateway({ runner: mockRunner });
    const socket = new MockSocket("socket-1");

    vi.mocked(mockRunner.createSession)
      .mockResolvedValueOnce({
        sessionId: "session-1",
        roomId: "room-1",
        container: {} as any,
        exec: {} as any,
        stream: {} as any,
        callback: { onData: vi.fn(), onExit: vi.fn() },
      })
      .mockResolvedValueOnce({
        sessionId: "session-2",
        roomId: "room-1",
        container: {} as any,
        exec: {} as any,
        stream: {} as any,
        callback: { onData: vi.fn(), onExit: vi.fn() },
      });

    gateway.handleConnection(socket as unknown as TerminalSocket);

    socket.simulateClientEvent("terminal:create", { sessionId: "session-1", roomId: "room-1" });
    socket.simulateClientEvent("terminal:create", { sessionId: "session-2", roomId: "room-1" });

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(gateway.getSessionIdsForSocket("socket-1").size).toBe(2);

    socket.simulateClientEvent("disconnect");

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(mockRunner.killSession).toHaveBeenCalledWith("session-1");
    expect(mockRunner.killSession).toHaveBeenCalledWith("session-2");
    expect(gateway.getSessionIdsForSocket("socket-1").size).toBe(0);
  });
});

describe("Execution Engine Server", () => {
  it("responds with 200 ok on GET /health", async () => {
    const mockRunner = createMockRunner();
    const server = createServer({ port: 0, runner: mockRunner });

    await new Promise<void>((resolve, reject) => {
      server.httpServer.once("error", reject);
      server.httpServer.listen(0, () => {
        resolve();
      });
    });

    const address = server.httpServer.address();
    const boundPort = typeof address === "object" && address ? address.port : 0;

    const res = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      http.get(`http://localhost:${String(boundPort)}/health`, (response) => {
        let body = "";
        response.on("data", (chunk: Buffer) => {
          body += chunk.toString("utf-8");
        });
        response.on("end", () => {
          resolve({ statusCode: response.statusCode ?? 0, body });
        });
        response.on("error", reject);
      }).on("error", reject);
    });

    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed).toEqual({ status: "ok", service: "execution-engine" });

    await server.stop();
    expect(mockRunner.cleanupAll).toHaveBeenCalled();
  });
});
