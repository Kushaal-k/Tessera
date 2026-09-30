import { describe, expect, it, vi } from "vitest";
import { PassThrough } from "node:stream";
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
        Tty: true,
        OpenStdin: true,
        HostConfig: expect.objectContaining({
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
        AttachStdin: true,
        AttachStdout: true,
      })
    );

    expect(mockExec.resize).toHaveBeenCalledWith({ h: 40, w: 120 });
    expect(runner.getActiveSessionCount()).toBe(1);
    expect(runner.getSession(session.sessionId)).toBeDefined();
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
});
