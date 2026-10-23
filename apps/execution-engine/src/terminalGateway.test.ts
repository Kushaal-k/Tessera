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
          workspaceId: "room-1",
          container: {} as any,
          exec: {} as any,
          stream: {} as any,
          callback: callbacks,
        };
      }
    );

    gateway.handleConnection(socket as unknown as TerminalSocket);

    socket.simulateClientEvent("terminal:create", {
      roomId: "room-1",
      cols: 80,
      rows: 24,
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(mockRunner.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
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
      roomId: "room-1",
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

    expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
      error: "Docker daemon failure",
    });
  });

  it("forwards terminal:data to runner.write and emits error on failure", async () => {
    const mockRunner = createMockRunner();
    const gateway = new TerminalGateway({ runner: mockRunner });
    const socket = new MockSocket("socket-1");

    vi.mocked(mockRunner.createSession).mockResolvedValue({
      sessionId: "session-123",
      roomId: "room-1",
      workspaceId: "room-1",
      container: {} as any,
      exec: {} as any,
      stream: {} as any,
      callback: { onData: vi.fn(), onExit: vi.fn() },
    });

    gateway.handleConnection(socket as unknown as TerminalSocket);

    socket.simulateClientEvent("terminal:create", { roomId: "room-1" });
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

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

    vi.mocked(mockRunner.createSession).mockResolvedValue({
      sessionId: "session-123",
      roomId: "room-1",
      workspaceId: "room-1",
      container: {} as any,
      exec: {} as any,
      stream: {} as any,
      callback: { onData: vi.fn(), onExit: vi.fn() },
    });

    gateway.handleConnection(socket as unknown as TerminalSocket);

    socket.simulateClientEvent("terminal:create", { roomId: "room-1" });
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });

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
      workspaceId: "room-1",
      container: {} as any,
      exec: {} as any,
      stream: {} as any,
      callback: { onData: vi.fn(), onExit: vi.fn() },
    });

    gateway.handleConnection(socket as unknown as TerminalSocket);

    socket.simulateClientEvent("terminal:create", {
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
        workspaceId: "room-1",
        container: {} as any,
        exec: {} as any,
        stream: {} as any,
        callback: { onData: vi.fn(), onExit: vi.fn() },
      })
      .mockResolvedValueOnce({
        sessionId: "session-2",
        roomId: "room-1",
        workspaceId: "room-1",
        container: {} as any,
        exec: {} as any,
        stream: {} as any,
        callback: { onData: vi.fn(), onExit: vi.fn() },
      });

    gateway.handleConnection(socket as unknown as TerminalSocket);

    socket.simulateClientEvent("terminal:create", { roomId: "room-1" });
    socket.simulateClientEvent("terminal:create", { roomId: "room-1" });

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

  describe("runtime boundary validation", () => {
    it("rejects terminal:create when payload is not an object or roomId is missing", async () => {
      const mockRunner = createMockRunner();
      const gateway = new TerminalGateway({ runner: mockRunner });
      const socket = new MockSocket("socket-1");
      gateway.handleConnection(socket as unknown as TerminalSocket);

      socket.simulateClientEvent("terminal:create", null);
      expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
        error: "Invalid payload: must be a non-null object",
      });

      socket.simulateClientEvent("terminal:create", { cols: 80 });
      expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
        error: "Invalid payload: roomId must be a non-empty string",
      });
      expect(mockRunner.createSession).not.toHaveBeenCalled();
    });

    it("rejects terminal:create with invalid viewport dimensions", async () => {
      const mockRunner = createMockRunner();
      const gateway = new TerminalGateway({ runner: mockRunner });
      const socket = new MockSocket("socket-1");
      gateway.handleConnection(socket as unknown as TerminalSocket);

      socket.simulateClientEvent("terminal:create", {
        roomId: "room-1",
        cols: -10,
      });
      expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
        error: "Invalid payload: cols must be an integer between 1 and 1000",
      });

      socket.simulateClientEvent("terminal:create", {
        roomId: "room-1",
        rows: 9999,
      });
      expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
        error: "Invalid payload: rows must be an integer between 1 and 500",
      });
      expect(mockRunner.createSession).not.toHaveBeenCalled();
    });

    it("rejects terminal:data with missing sessionId or oversized payload", async () => {
      const mockRunner = createMockRunner();
      const gateway = new TerminalGateway({ runner: mockRunner });
      const socket = new MockSocket("socket-1");
      gateway.handleConnection(socket as unknown as TerminalSocket);

      socket.simulateClientEvent("terminal:data", { sessionId: "", data: "ls" });
      expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: undefined,
        error: "Invalid payload: sessionId must be a non-empty string",
      });

      socket.simulateClientEvent("terminal:data", { sessionId: "s-1", data: 123 });
      expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: "s-1",
        error: "Invalid payload: data must be a string",
      });

      const oversized = "x".repeat(512 * 1024 + 1);
      socket.simulateClientEvent("terminal:data", { sessionId: "s-1", data: oversized });
      expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: "s-1",
        error: "Terminal data payload exceeds maximum allowed size",
      });
      expect(mockRunner.write).not.toHaveBeenCalled();
    });

    it("rejects terminal:resize with out-of-bounds or non-integer dimensions", async () => {
      const mockRunner = createMockRunner();
      const gateway = new TerminalGateway({ runner: mockRunner });
      const socket = new MockSocket("socket-1");
      gateway.handleConnection(socket as unknown as TerminalSocket);

      socket.simulateClientEvent("terminal:resize", { sessionId: "s-1", cols: 80.5, rows: 24 });
      expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: "s-1",
        error: "Invalid payload: cols must be an integer between 1 and 1000",
      });

      socket.simulateClientEvent("terminal:resize", { sessionId: "s-1", cols: 80, rows: 0 });
      expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: "s-1",
        error: "Invalid payload: rows must be an integer between 1 and 500",
      });
      expect(mockRunner.resize).not.toHaveBeenCalled();
    });

    it("rejects terminal:kill with missing or invalid sessionId", async () => {
      const mockRunner = createMockRunner();
      const gateway = new TerminalGateway({ runner: mockRunner });
      const socket = new MockSocket("socket-1");
      gateway.handleConnection(socket as unknown as TerminalSocket);

      socket.simulateClientEvent("terminal:kill", { sessionId: "   " });
      expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: undefined,
        error: "Invalid payload: sessionId must be a non-empty string",
      });
      expect(mockRunner.killSession).not.toHaveBeenCalled();
    });
  });

  describe("session ownership and lifecycle isolation", () => {
    it("prevents cross-workspace session operations when client knows foreign session ID", async () => {
      const mockRunner = createMockRunner();
      const gateway = new TerminalGateway({ runner: mockRunner });
      const socketA = new MockSocket("socket-a");
      const socketB = new MockSocket("socket-b");

      vi.mocked(mockRunner.createSession)
        .mockResolvedValueOnce({
          sessionId: "session-alpha",
          roomId: "room-alpha",
          workspaceId: "room-alpha",
          container: {} as any,
          exec: {} as any,
          stream: {} as any,
          callback: { onData: vi.fn(), onExit: vi.fn() },
        })
        .mockResolvedValueOnce({
          sessionId: "session-beta",
          roomId: "room-beta",
          workspaceId: "room-beta",
          container: {} as any,
          exec: {} as any,
          stream: {} as any,
          callback: { onData: vi.fn(), onExit: vi.fn() },
        });

      gateway.handleConnection(socketA as unknown as TerminalSocket);
      gateway.handleConnection(socketB as unknown as TerminalSocket);

      socketA.simulateClientEvent("terminal:create", { roomId: "room-alpha" });
      socketB.simulateClientEvent("terminal:create", { roomId: "room-beta" });

      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect(gateway.getSessionIdsForSocket("socket-a")).toContain("session-alpha");
      expect(gateway.getSessionIdsForSocket("socket-b")).toContain("session-beta");

      // Socket B tries to write to Socket A's session in room-alpha
      socketB.simulateClientEvent("terminal:data", {
        sessionId: "session-alpha",
        data: "echo foreign write\n",
      });
      expect(mockRunner.write).not.toHaveBeenCalledWith("session-alpha", expect.anything());
      expect(socketB.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: "session-alpha",
        error: "Terminal session not found or unauthorized",
      });

      // Socket B tries to resize Socket A's session
      socketB.simulateClientEvent("terminal:resize", {
        sessionId: "session-alpha",
        cols: 120,
        rows: 40,
      });
      expect(mockRunner.resize).not.toHaveBeenCalledWith("session-alpha", expect.anything(), expect.anything());
      expect(socketB.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: "session-alpha",
        error: "Terminal session not found or unauthorized",
      });

      // Socket B tries to kill Socket A's session
      socketB.simulateClientEvent("terminal:kill", {
        sessionId: "session-alpha",
      });
      expect(mockRunner.killSession).not.toHaveBeenCalledWith("session-alpha");
      expect(socketB.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: "session-alpha",
        error: "Terminal session not found or unauthorized",
      });

      // Socket A operates its own session without errors
      socketA.simulateClientEvent("terminal:data", {
        sessionId: "session-alpha",
        data: "echo legitimate\n",
      });
      expect(mockRunner.write).toHaveBeenCalledWith("session-alpha", "echo legitimate\n");
    });

    it("prevents same-workspace session operations between distinct clients", async () => {
      const mockRunner = createMockRunner();
      const gateway = new TerminalGateway({ runner: mockRunner });
      const socketA = new MockSocket("socket-a");
      const socketB = new MockSocket("socket-b");

      vi.mocked(mockRunner.createSession)
        .mockResolvedValueOnce({
          sessionId: "session-collab-a",
          roomId: "room-collab",
          workspaceId: "room-collab",
          container: {} as any,
          exec: {} as any,
          stream: {} as any,
          callback: { onData: vi.fn(), onExit: vi.fn() },
        })
        .mockResolvedValueOnce({
          sessionId: "session-collab-b",
          roomId: "room-collab",
          workspaceId: "room-collab",
          container: {} as any,
          exec: {} as any,
          stream: {} as any,
          callback: { onData: vi.fn(), onExit: vi.fn() },
        });

      gateway.handleConnection(socketA as unknown as TerminalSocket);
      gateway.handleConnection(socketB as unknown as TerminalSocket);

      socketA.simulateClientEvent("terminal:create", { roomId: "room-collab" });
      socketB.simulateClientEvent("terminal:create", { roomId: "room-collab" });

      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      socketB.simulateClientEvent("terminal:data", {
        sessionId: "session-collab-a",
        data: "rm -rf /\n",
      });
      expect(mockRunner.write).not.toHaveBeenCalledWith("session-collab-a", expect.anything());
      expect(socketB.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: "session-collab-a",
        error: "Terminal session not found or unauthorized",
      });

      socketB.simulateClientEvent("terminal:resize", {
        sessionId: "session-collab-a",
        cols: 60,
        rows: 20,
      });
      expect(mockRunner.resize).not.toHaveBeenCalledWith("session-collab-a", expect.anything(), expect.anything());
      expect(socketB.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: "session-collab-a",
        error: "Terminal session not found or unauthorized",
      });

      socketB.simulateClientEvent("terminal:kill", {
        sessionId: "session-collab-a",
      });
      expect(mockRunner.killSession).not.toHaveBeenCalledWith("session-collab-a");
      expect(socketB.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: "session-collab-a",
        error: "Terminal session not found or unauthorized",
      });
    });

    it("rejects repeated terminal:kill for an already untracked session", async () => {
      const mockRunner = createMockRunner();
      const gateway = new TerminalGateway({ runner: mockRunner });
      const socket = new MockSocket("socket-1");

      vi.mocked(mockRunner.createSession).mockResolvedValue({
        sessionId: "session-kill-once",
        roomId: "room-1",
        workspaceId: "room-1",
        container: {} as any,
        exec: {} as any,
        stream: {} as any,
        callback: { onData: vi.fn(), onExit: vi.fn() },
      });

      gateway.handleConnection(socket as unknown as TerminalSocket);

      socket.simulateClientEvent("terminal:create", { roomId: "room-1" });
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      socket.simulateClientEvent("terminal:kill", { sessionId: "session-kill-once" });
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect(mockRunner.killSession).toHaveBeenCalledTimes(1);
      expect(mockRunner.killSession).toHaveBeenCalledWith("session-kill-once");
      expect(gateway.getSessionIdsForSocket("socket-1")).not.toContain("session-kill-once");

      // Repeated kill by the same socket
      socket.simulateClientEvent("terminal:kill", { sessionId: "session-kill-once" });
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect(mockRunner.killSession).toHaveBeenCalledTimes(1);
      expect(socket.emit).toHaveBeenCalledWith("terminal:error", {
        sessionId: "session-kill-once",
        error: "Terminal session not found or unauthorized",
      });
    });

    it("ignores client-supplied session ID in create payload to prevent ID replacement and hijacking", async () => {
      const mockRunner = createMockRunner();
      const gateway = new TerminalGateway({ runner: mockRunner });
      const socketA = new MockSocket("socket-a");
      const socketB = new MockSocket("socket-b");

      vi.mocked(mockRunner.createSession)
        .mockResolvedValueOnce({
          sessionId: "legit-server-id-1",
          roomId: "room-1",
          workspaceId: "room-1",
          container: {} as any,
          exec: {} as any,
          stream: {} as any,
          callback: { onData: vi.fn(), onExit: vi.fn() },
        })
        .mockResolvedValueOnce({
          sessionId: "legit-server-id-2",
          roomId: "room-1",
          workspaceId: "room-1",
          container: {} as any,
          exec: {} as any,
          stream: {} as any,
          callback: { onData: vi.fn(), onExit: vi.fn() },
        });

      gateway.handleConnection(socketA as unknown as TerminalSocket);
      gateway.handleConnection(socketB as unknown as TerminalSocket);

      socketA.simulateClientEvent("terminal:create", { roomId: "room-1" });
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      // Socket B attempts to pass a spoofed sessionId aiming to replace or hijack
      socketB.simulateClientEvent("terminal:create", {
        roomId: "room-1",
        sessionId: "legit-server-id-1",
      });
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect(mockRunner.createSession).toHaveBeenLastCalledWith(
        expect.not.objectContaining({ sessionId: "legit-server-id-1" }),
        expect.any(Object)
      );
      expect(socketB.emit).toHaveBeenCalledWith("terminal:created", {
        sessionId: "legit-server-id-2",
      });

      // Socket B still cannot access legit-server-id-1
      socketB.simulateClientEvent("terminal:data", {
        sessionId: "legit-server-id-1",
        data: "exploit\n",
      });
      expect(mockRunner.write).not.toHaveBeenCalledWith("legit-server-id-1", expect.anything());
    });

    it("cleans up orphaned terminal session if socket disconnects during startup", async () => {
      const mockRunner = createMockRunner();
      const gateway = new TerminalGateway({ runner: mockRunner });
      const socket = new MockSocket("socket-race");

      let resolveSessionStartup!: (value: any) => void;
      const delayedStartupPromise = new Promise((resolve) => {
        resolveSessionStartup = resolve;
      });

      vi.mocked(mockRunner.createSession).mockImplementation(async () => {
        return (await delayedStartupPromise) as any;
      });

      gateway.handleConnection(socket as unknown as TerminalSocket);

      // Socket starts creation
      socket.simulateClientEvent("terminal:create", { roomId: "room-slow-startup" });

      // Socket leaves / disconnects before container startup completes
      socket.simulateClientEvent("disconnect");

      // Startup finishes afterwards
      resolveSessionStartup({
        sessionId: "orphan-session-999",
        roomId: "room-slow-startup",
        workspaceId: "room-slow-startup",
        container: {} as any,
        exec: {} as any,
        stream: {} as any,
        callback: { onData: vi.fn(), onExit: vi.fn() },
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });

      // Gateway must have caught the disconnect, killed the orphan immediately, and not tracked it
      expect(mockRunner.killSession).toHaveBeenCalledWith("orphan-session-999");
      expect(gateway.getSessionIdsForSocket("socket-race").size).toBe(0);
      expect(socket.emit).not.toHaveBeenCalledWith("terminal:created", expect.anything());
    });
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
