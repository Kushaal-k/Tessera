import * as Y from "yjs";
import type { Socket } from "socket.io";
import type {
  SyncClientToServerEvents,
  SyncServerToClientEvents,
} from "@tessera/shared-types";

interface DocumentRoom {
  readonly roomId: string;
  readonly doc: Y.Doc;
}

export function registerDocumentSyncHandlers(
  socket: Socket<SyncClientToServerEvents, SyncServerToClientEvents>,
  getRoom: () => DocumentRoom | null,
): void {
  socket.on("sync-step-1", (data) => {
    const room = getRoom();
    if (!room) {
      return;
    }
    try {
      const update = Y.encodeStateAsUpdate(room.doc, new Uint8Array(data));
      socket.emit("sync-step-2", update);
    } catch (error: unknown) {
      console.error(`sync-step-1 error [room=${room.roomId}]:`, error);
    }
  });

  const applyAndBroadcast = (data: Uint8Array): void => {
    const room = getRoom();
    if (!room) {
      return;
    }
    try {
      Y.applyUpdate(room.doc, new Uint8Array(data), socket);
      // Handshake updates can contain structs needed by subsequent live edits.
      socket.to(room.roomId).emit("sync-update", data);
    } catch (error: unknown) {
      console.error(`document update error [room=${room.roomId}]:`, error);
    }
  };

  socket.on("sync-step-2", applyAndBroadcast);
  socket.on("sync-update", applyAndBroadcast);
}
