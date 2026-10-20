import { afterEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import { Server } from "socket.io";
import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { createWorkspace, TesseraSocketProvider } from "@tessera/collaboration";
import { registerDocumentSyncHandlers, extractBinaryPayload } from "./documentSync.js";

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.reverse()) {
    await close();
  }
  cleanup.length = 0;
});

describe("extractBinaryPayload", () => {
  it("returns null for non-binary and falsy inputs", () => {
    expect(extractBinaryPayload(null)).toBeNull();
    expect(extractBinaryPayload(undefined)).toBeNull();
    expect(extractBinaryPayload("hello")).toBeNull();
    expect(extractBinaryPayload(12345)).toBeNull();
    expect(extractBinaryPayload({})).toBeNull();
    expect(extractBinaryPayload([])).toBeNull();
  });

  it("returns null for zero-byte binary payloads", () => {
    expect(extractBinaryPayload(new Uint8Array(0))).toBeNull();
    expect(extractBinaryPayload(Buffer.alloc(0))).toBeNull();
    expect(extractBinaryPayload(new ArrayBuffer(0))).toBeNull();
  });

  it("returns null when payload exceeds maxBytes", () => {
    const payload = new Uint8Array(100);
    expect(extractBinaryPayload(payload, 50)).toBeNull();
    expect(extractBinaryPayload(payload, 100)).not.toBeNull();
  });

  it("correctly normalizes Uint8Array, Buffer, and ArrayBuffer views", () => {
    const sample = new Uint8Array([1, 2, 3, 4]);
    const fromUint8 = extractBinaryPayload(sample);
    expect(fromUint8).toBeInstanceOf(Uint8Array);
    expect(Array.from(fromUint8!)).toEqual([1, 2, 3, 4]);

    const buf = Buffer.from([5, 6, 7]);
    const fromBuf = extractBinaryPayload(buf);
    expect(fromBuf).toBeInstanceOf(Uint8Array);
    expect(Array.from(fromBuf!)).toEqual([5, 6, 7]);

    const ab = new Uint8Array([8, 9]).buffer;
    const fromAb = extractBinaryPayload(ab);
    expect(fromAb).toBeInstanceOf(Uint8Array);
    expect(Array.from(fromAb!)).toEqual([8, 9]);
  });
});

describe("document synchronization runtime validation", () => {
  it("emits sync-error when sync-step-1 is called before joining a room", async () => {
    const server = http.createServer();
    const sockets = new Server(server);
    sockets.on("connection", (socket) => {
      registerDocumentSyncHandlers(socket, () => null);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    cleanup.push(async () => {
      await new Promise<void>((resolve) => {
        sockets.close(() => resolve());
      });
    });

    const address = server.address() as { port: number };
    const client: Socket = io(`http://127.0.0.1:${String(address.port)}`, {
      autoConnect: false,
      transports: ["websocket"],
    });
    cleanup.push(() => {
      client.disconnect();
    });

    const errorPromise = new Promise<{ code?: string; message: string }>((resolve) => {
      client.on("sync-error", resolve);
    });

    client.connect();
    await new Promise<void>((resolve) => {
      client.on("connect", () => {
        client.emit("sync-step-1", new Uint8Array([0]));
        resolve();
      });
    });

    const err = await errorPromise;
    expect(err.code).toBe("ROOM_NOT_FOUND");
  });

  it("emits sync-error when sync-step-1 payload is invalid or empty", async () => {
    const server = http.createServer();
    const sockets = new Server(server);
    const roomDoc = new Y.Doc();
    const roomId = "room-val";

    sockets.on("connection", (socket) => {
      registerDocumentSyncHandlers(socket, () => ({ roomId, doc: roomDoc }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    cleanup.push(async () => {
      await new Promise<void>((resolve) => {
        sockets.close(() => resolve());
      });
      roomDoc.destroy();
    });

    const address = server.address() as { port: number };
    const client: Socket = io(`http://127.0.0.1:${String(address.port)}`, {
      autoConnect: false,
      transports: ["websocket"],
    });
    cleanup.push(() => {
      client.disconnect();
    });

    const errors: { code?: string; message: string }[] = [];
    client.on("sync-error", (e) => {
      errors.push(e);
    });

    client.connect();
    await new Promise<void>((resolve) => {
      client.on("connect", () => {
        resolve();
      });
    });

    client.emit("sync-step-1", "not-binary");
    client.emit("sync-step-1", new Uint8Array(0));

    await vi.waitFor(() => {
      expect(errors.length).toBe(2);
      expect(errors[0]?.code).toBe("INVALID_STATE_VECTOR");
      expect(errors[1]?.code).toBe("INVALID_STATE_VECTOR");
    });
  });

  it("handles corrupted sync-step-2 update without terminating the service", async () => {
    const server = http.createServer();
    const sockets = new Server(server);
    const roomDoc = new Y.Doc();
    const roomId = "room-corrupted";

    sockets.on("connection", (socket) => {
      registerDocumentSyncHandlers(socket, () => ({ roomId, doc: roomDoc }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    cleanup.push(async () => {
      await new Promise<void>((resolve) => {
        sockets.close(() => resolve());
      });
      roomDoc.destroy();
    });

    const address = server.address() as { port: number };
    const client: Socket = io(`http://127.0.0.1:${String(address.port)}`, {
      autoConnect: false,
      transports: ["websocket"],
    });
    cleanup.push(() => {
      client.disconnect();
    });

    const errorPromise = new Promise<{ code?: string; message: string }>((resolve) => {
      client.on("sync-error", resolve);
    });

    client.connect();
    await new Promise<void>((resolve) => {
      client.on("connect", () => {
        // Send arbitrary non-Yjs bytes that will cause Y.applyUpdate to throw
        client.emit("sync-step-2", new Uint8Array([255, 255, 255, 255]));
        resolve();
      });
    });

    const err = await errorPromise;
    expect(err.code).toBe("APPLY_UPDATE_ERROR");
  });
});

describe("document synchronization", () => {
  it("broadcasts handshake state needed by later edits and reconnects", async () => {
    const server = http.createServer();
    const sockets = new Server(server);
    const roomDoc = new Y.Doc();
    const roomId = "protocol-room";
    sockets.on("connection", (socket) => {
      let joined = false;
      socket.on("join-room", () => {
        joined = true;
        void socket.join(roomId);
        socket.emit("sync-step-1", Y.encodeStateVector(roomDoc));
      });
      registerDocumentSyncHandlers(socket, () => (joined ? { roomId, doc: roomDoc } : null));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    cleanup.push(async () => {
      await new Promise<void>((resolve) => sockets.close(() => resolve()));
      roomDoc.destroy();
    });
    const address = server.address() as { port: number };
    const connect = async (id: string) => {
      const doc = new Y.Doc();
      const workspace = createWorkspace({ id: roomId, name: id }, doc);
      const awareness = new Awareness(doc);
      const socket: Socket = io(`http://127.0.0.1:${address.port}`, { autoConnect: false, transports: ["websocket"] });
      let provider: TesseraSocketProvider;
      socket.on("connect", () => {
        socket.emit("join-room", { roomId });
        provider?.destroy();
        provider = new TesseraSocketProvider({ socket, ydoc: doc, awareness });
      });
      cleanup.push(() => {
        provider?.destroy();
        socket.disconnect();
        awareness.destroy();
        doc.destroy();
      });
      socket.connect();
      await vi.waitFor(() => expect(provider?.isSynced).toBe(true));
      return { doc, workspace, socket };
    };
    const first = await connect("first");
    const second = await connect("second");
    const file = second.workspace.createFile("live.js", { initialContent: "first edit" }).file!;
    await vi.waitFor(() => expect(first.workspace.getFileContent(file.id)).toBe("first edit"));
    second.socket.disconnect();
    second.workspace.updateFileContent(file.id, "edited while offline");
    second.socket.connect();
    await vi.waitFor(() => expect(first.workspace.getFileContent(file.id)).toBe("edited while offline"));
    first.workspace.updateFileContent(file.id, "reply");
    await vi.waitFor(() => expect(second.workspace.getFileContent(file.id)).toBe("reply"));
  });
});
