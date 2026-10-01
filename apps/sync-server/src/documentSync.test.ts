import { afterEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import { Server } from "socket.io";
import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { createWorkspace, TesseraSocketProvider } from "@tessera/collaboration";
import { registerDocumentSyncHandlers } from "./documentSync.js";

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.reverse()) {
    await close();
  }
  cleanup.length = 0;
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
      registerDocumentSyncHandlers(socket, () => joined ? { roomId, doc: roomDoc } : null);
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
