import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import * as Y from "yjs";
import {
  createCollaborationDoc,
  createAwareness,
  setLocalParticipant,
  TesseraSocketProvider,
} from "@tessera/collaboration";
import type { Participant, SyncConnectionConfig } from "@tessera/shared-types";
import type { Awareness } from "y-protocols/awareness";

interface UseCollaborationReturn {
  readonly ydoc: Y.Doc | null;
  readonly ytext: Y.Text | null;
  readonly awareness: Awareness | null;
  readonly connected: boolean;
  readonly socket: Socket | null;
}

export function useCollaboration(config: SyncConnectionConfig): UseCollaborationReturn {
  const [connected, setConnected] = useState(false);
  const providerRef = useRef<TesseraSocketProvider | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const docRef = useRef<ReturnType<typeof createCollaborationDoc> | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [ytext, setYtext] = useState<Y.Text | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  const cleanup = useCallback(() => {
    providerRef.current?.destroy();
    providerRef.current = null;

    socketRef.current?.disconnect();
    socketRef.current = null;

    docRef.current?.destroy();
    docRef.current = null;

    awarenessRef.current = null;
    setConnected(false);
    setYdoc(null);
    setYtext(null);
    setAwareness(null);
    setSocketInstance(null);
  }, []);

  useEffect(() => {
    const collabDoc = createCollaborationDoc({
      room: {
        roomId: config.roomId,
        name: config.roomId,
        participants: [],
        createdAt: new Date().toISOString(),
      },
    });

    const awarenessInstance = createAwareness(collabDoc.ydoc);
    setLocalParticipant(awarenessInstance, config.participant);

    const socket: Socket = io(config.serverUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    docRef.current = collabDoc;
    socketRef.current = socket;
    awarenessRef.current = awarenessInstance;
    setSocketInstance(socket);

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-room", {
        roomId: config.roomId,
        participant: config.participant,
      });

      providerRef.current?.destroy();
      const provider = new TesseraSocketProvider({
        socket,
        ydoc: collabDoc.ydoc,
        awareness: awarenessInstance,
      });
      providerRef.current = provider;
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    setYdoc(collabDoc.ydoc);
    setYtext(collabDoc.ytext);
    setAwareness(awarenessInstance);

    return cleanup;
  }, [config.serverUrl, config.roomId, config.participant, cleanup]);

  return { ydoc, ytext, awareness, connected, socket: socketInstance };
}

export function createDefaultParticipant(overrides?: Partial<Participant>): Participant {
  return {
    id: crypto.randomUUID(),
    displayName: "Anonymous",
    isAI: false,
    cursorColor: `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`,
    ...overrides,
  };
}
