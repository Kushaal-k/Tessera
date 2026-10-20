import * as Y from "yjs";
import type { Socket } from "socket.io";
import type {
  SyncClientToServerEvents,
  SyncServerToClientEvents,
} from "@tessera/shared-types";

export interface DocumentRoom {
  readonly roomId: string;
  readonly doc: Y.Doc;
}

export const MAX_SYNC_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10MB limit

export function extractBinaryPayload(
  data: unknown,
  maxBytes: number = MAX_SYNC_PAYLOAD_BYTES,
): Uint8Array | null {
  if (data === null || data === undefined) {
    return null;
  }

  let binary: Uint8Array;
  if (data instanceof Uint8Array) {
    binary = data;
  } else if (Buffer.isBuffer(data)) {
    binary = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else if (data instanceof ArrayBuffer) {
    binary = new Uint8Array(data);
  } else if (ArrayBuffer.isView(data)) {
    binary = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else {
    return null;
  }

  if (binary.byteLength === 0 || binary.byteLength > maxBytes) {
    return null;
  }

  return binary;
}

export function registerDocumentSyncHandlers(
  socket: Socket<SyncClientToServerEvents, SyncServerToClientEvents>,
  getRoom: () => DocumentRoom | null,
): void {
  socket.on("sync-step-1", (rawStateVector: unknown) => {
    const room = getRoom();
    if (!room) {
      socket.emit("sync-error", {
        code: "ROOM_NOT_FOUND",
        message: "Cannot perform sync-step-1 without joining a room",
      });
      return;
    }

    const stateVector = extractBinaryPayload(rawStateVector, MAX_SYNC_PAYLOAD_BYTES);
    if (!stateVector) {
      socket.emit("sync-error", {
        code: "INVALID_STATE_VECTOR",
        message: "State vector must be a non-empty binary payload under 10MB",
      });
      return;
    }

    try {
      const update = Y.encodeStateAsUpdate(room.doc, stateVector);
      socket.emit("sync-step-2", update);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`sync-step-1 error [room=${room.roomId}]:`, message);
      socket.emit("sync-error", {
        code: "ENCODE_STATE_ERROR",
        message: `Failed to encode state update: ${message}`,
      });
    }
  });

  const applyAndBroadcast = (eventName: "sync-step-2" | "sync-update") => (rawData: unknown): void => {
    const room = getRoom();
    if (!room) {
      socket.emit("sync-error", {
        code: "ROOM_NOT_FOUND",
        message: `Cannot perform ${eventName} without joining a room`,
      });
      return;
    }

    const binary = extractBinaryPayload(rawData, MAX_SYNC_PAYLOAD_BYTES);
    if (!binary) {
      socket.emit("sync-error", {
        code: "INVALID_SYNC_UPDATE",
        message: `${eventName} update must be a non-empty binary payload under 10MB`,
      });
      return;
    }

    try {
      Y.applyUpdate(room.doc, binary, socket);
      // Handshake updates can contain structs needed by subsequent live edits.
      socket.to(room.roomId).emit("sync-update", binary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`document update error [room=${room.roomId}]:`, message);
      socket.emit("sync-error", {
        code: "APPLY_UPDATE_ERROR",
        message: `Failed to apply document update: ${message}`,
      });
    }
  };

  socket.on("sync-step-2", applyAndBroadcast("sync-step-2") as (update: Uint8Array) => void);
  socket.on("sync-update", applyAndBroadcast("sync-update") as (update: Uint8Array) => void);
}
