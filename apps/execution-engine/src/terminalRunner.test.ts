import { describe, expect, it, vi } from "vitest";
import { PassThrough } from "node:stream";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { WorkspaceStorage } from "./workspaceStorage.js";
import type Dockerode from "dockerode";
import { TerminalRunner } from "./terminalRunner.js";

function createMockDocker() {
  const stream = new PassThrough();
  const mockExec = {
    start: vi.fn().mockResolvedValue(stream),
    resize: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
  };
  const mockContainer = {
    start: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn(),
    exec: vi.fn().mockResolvedValue(mockExec),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const mockDocker = {
    createContainer: vi.fn().mockResolvedValue(mockContainer),
  } as unknown as Dockerode;

  return {
    mockDocker,
    mockContainer,
    mockExec,
    stream,
  };
}

describe("TerminalRunner", () => {
  it("enforces container security isolation and allocates pseudo-terminal", async () => {
    const { mockDocker, mockContainer, mockExec } = createMockDocker();
    const runner = new TerminalRunner({ docker: mockDocker });

    const session = await runner.createSession(
      {
        roomId: "room-123",
        cols: 120,
        rows: 40,
      },
      {
        onData: vi.fn(),
        onExit: vi.fn(),
      }
    );

    expect(mockDocker.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        User: "1000",
        WorkingDir: "/workspace",
        Tty: true,
        OpenStdin: true,
        HostConfig: expect.objectContaining({
          Binds: expect.arrayContaining([expect.stringContaining(":/workspace:rw")]),
          CapDrop: ["ALL"],
          SecurityOpt: ["no-new-privileges:true"],
        }),
      })
    );

    expect(mockContainer.exec).toHaveBeenCalledWith(
      expect.objectContaining({
        Cmd: ["/bin/sh"],
        Tty: true,
        User: "1000",
        WorkingDir: "/workspace",
        AttachStdin: true,
        AttachStdout: true,
      })
    );

    expect(mockExec.resize).toHaveBeenCalledWith({ h: 40, w: 120 });
    expect(runner.getActiveSessionCount()).toBe(1);
    expect(runner.getSession(session.sessionId)).toBeDefined();
  });

  it("seeds initial workspace files when provided in payload", async () => {
    const { mockDocker } = createMockDocker();
    const runner = new TerminalRunner({ docker: mockDocker });

    await runner.createSession(
      {
        roomId: "room-seed-test",
        initialFiles: [
          { path: "server.js", content: "console.log('started');" },
        ],
      },
      {
        onData: vi.fn(),
        onExit: vi.fn(),
      }
    );

    expect(mockDocker.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        HostConfig: expect.objectContaining({
          Binds: expect.arrayContaining([
            expect.stringContaining("room-seed-test:/workspace:rw"),
          ]),
        }),
      })
    );
  });

  it("pipes input data to the exec stream", async () => {
    const { mockDocker, stream } = createMockDocker();
    const runner = new TerminalRunner({ docker: mockDocker });
    const writeSpy = vi.spyOn(stream, "write");

    const session = await runner.createSession(
      { roomId: "room-123" },
      { onData: vi.fn(), onExit: vi.fn() }
    );

    runner.write(session.sessionId, "ls -la\n");
    expect(writeSpy).toHaveBeenCalledWith("ls -la\n");
  });

  it("emits onData chunks from the exec stream", async () => {
    const { mockDocker, stream } = createMockDocker();
    const runner = new TerminalRunner({ docker: mockDocker });
    const onData = vi.fn();

    await runner.createSession(
      { roomId: "room-123" },
      { onData, onExit: vi.fn() }
    );

    stream.emit("data", Buffer.from("hello from terminal"));
    expect(onData).toHaveBeenCalledWith("hello from terminal");
  });

  it("resizes the terminal viewport", async () => {
    const { mockDocker, mockExec } = createMockDocker();
    const runner = new TerminalRunner({ docker: mockDocker });

    const session = await runner.createSession(
      { roomId: "room-123" },
      { onData: vi.fn(), onExit: vi.fn() }
    );

    await runner.resize(session.sessionId, 100, 30);
    expect(mockExec.resize).toHaveBeenCalledWith({ h: 30, w: 100 });
  });

  it("cleans up session, removes container, and invokes onExit when stream ends", async () => {
    const { mockDocker, mockContainer, stream } = createMockDocker();
    const runner = new TerminalRunner({ docker: mockDocker });
    const onExit = vi.fn();

    const session = await runner.createSession(
      { roomId: "room-123" },
      { onData: vi.fn(), onExit }
    );

    stream.emit("end");
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });

    expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    expect(onExit).toHaveBeenCalledWith(0);
    expect(runner.getActiveSessionCount()).toBe(0);
    expect(runner.getSession(session.sessionId)).toBeUndefined();
  });

  it("throws when writing or resizing an invalid session", async () => {
    const { mockDocker } = createMockDocker();
    const runner = new TerminalRunner({ docker: mockDocker });

    expect(() => {
      runner.write("non-existent", "test");
    }).toThrow("not found");

    await expect(runner.resize("non-existent", 80, 24)).rejects.toThrow("not found");
  });

  it("cleans up all running sessions on shutdown", async () => {
    const { mockDocker, mockContainer } = createMockDocker();
    const runner = new TerminalRunner({ docker: mockDocker });

    await runner.createSession({ roomId: "room-1" }, { onData: vi.fn(), onExit: vi.fn() });
    await runner.createSession({ roomId: "room-2" }, { onData: vi.fn(), onExit: vi.fn() });
    expect(runner.getActiveSessionCount()).toBe(2);

    await runner.cleanupAll();
    expect(runner.getActiveSessionCount()).toBe(0);
    expect(mockContainer.remove).toHaveBeenCalledTimes(2);
  });

  it("attaches FsWatcher to session and stops watcher on killSession", async () => {
    const { mockDocker } = createMockDocker();
    const runner = new TerminalRunner({ docker: mockDocker });
    const onFsEvent = vi.fn();

    const session = await runner.createSession(
      { roomId: "room-watcher-test" },
      { onData: vi.fn(), onExit: vi.fn(), onFsEvent }
    );

    expect(session.watcher).toBeDefined();
    expect(session.watcher?.isWatching()).toBe(true);

    const stopSpy = vi.spyOn(session.watcher!, "stop");
    await runner.killSession(session.sessionId);

    expect(stopSpy).toHaveBeenCalled();
  });
});


describe("workspace synchronization lifecycle", () => {
  it("shares the watcher until the last terminal session closes", async () => {
    const first = createMockDocker();
    const second = createMockDocker();
    const containers = [first.mockContainer, second.mockContainer];
    const docker = {
      createContainer: vi.fn(async () => containers.shift()),
    } as unknown as Dockerode;
    const runner = new TerminalRunner({ docker, enableSyncBridge: false });
    const a = await runner.createSession(
      { roomId: "shared-watcher-room", workspaceId: "shared-watcher-storage" },
      { onData: vi.fn(), onExit: vi.fn() },
    );
    const b = await runner.createSession(
      { roomId: "shared-watcher-room", workspaceId: "shared-watcher-storage" },
      { onData: vi.fn(), onExit: vi.fn() },
    );
    try {
      expect(a.watcher).toBe(b.watcher);
      expect(runner.getSessionsForWorkspace("shared-watcher-storage")).toHaveLength(2);
      await runner.killSession(a.sessionId);
      expect(b.watcher?.isWatching()).toBe(true);
      await runner.killSession(b.sessionId);
      expect(b.watcher?.isWatching()).toBe(false);
    } finally {
      await runner.cleanupAll();
    }
  });
});

describe("workspace preview container selection", () => {
  async function setup(ips: readonly (string | null)[]) {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "tessera-preview-selection-"));
    const mocks = ips.map((ip) => {
      const mock = createMockDocker();
      mock.mockContainer.inspect.mockResolvedValue({
        NetworkSettings: { Networks: ip ? { bridge: { IPAddress: ip } } : {} },
      });
      return mock;
    });
    let index = 0;
    const docker = {
      createContainer: vi.fn(async () => mocks[index++]!.mockContainer),
    } as unknown as Dockerode;
    const runner = new TerminalRunner({
      docker, enableSyncBridge: false,
      workspaceStorage: new WorkspaceStorage({ baseDir }),
    });
    for (const _ip of ips) {
      await runner.createSession({ roomId: "preview-room" }, { onData: vi.fn(), onExit: vi.fn() });
    }
    return {
      runner, mocks,
      dispose: async () => {
        await runner.cleanupAll();
        await fs.rm(baseDir, { recursive: true, force: true });
      },
    };
  }

  it("selects the listening container when a server starts in the second terminal", async () => {
    const upstream = net.createServer();
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const port = (upstream.address() as net.AddressInfo).port;
    const context = await setup(["127.0.0.2", "127.0.0.1"]);
    try {
      expect(context.runner.getWorkspaceIds()).toEqual(["preview-room"]);
      expect(await context.runner.getWorkspaceContainerIp("preview-room", port)).toBe("127.0.0.1");
    } finally {
      await context.dispose();
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
    }
  });

  it("continues past a vanished or unaddressable container", async () => {
    const context = await setup(["127.0.0.2", null, "127.0.0.3"]);
    context.mocks[0]!.mockContainer.inspect.mockRejectedValue(new Error("Container removed"));
    try {
      expect(await context.runner.getWorkspaceContainerIp("preview-room")).toBe("127.0.0.3");
    } finally {
      await context.dispose();
    }
  });

  it("keeps a real container address for diagnostics when no server is listening", async () => {
    const upstream = net.createServer();
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    const port = (upstream.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    const context = await setup(["127.0.0.1"]);
    try {
      expect(await context.runner.getWorkspaceContainerIp("preview-room", port)).toBe("127.0.0.1");
      expect(await context.runner.getWorkspaceContainerIp("missing-room", port)).toBeNull();
    } finally {
      await context.dispose();
    }
  });

  it("does not fall back to the execution engine localhost for containers without an IP", async () => {
    const context = await setup([null]);
    try {
      expect(await context.runner.getWorkspaceContainerIp("preview-room")).toBeNull();
      await expect(context.runner.getWorkspaceContainerIp("preview-room", 70000)).rejects.toThrow("Invalid preview port");
    } finally {
      await context.dispose();
    }
  });
});
