import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import type { Socket } from "socket.io-client";

export interface TesseraProviderOptions {
  readonly socket: Socket;
  readonly ydoc: Y.Doc;
  readonly awareness: Awareness;
}

export class TesseraSocketProvider {
  readonly ydoc: Y.Doc;
  readonly awareness: Awareness;
  private readonly socket: Socket;
  private synced = false;
  private destroyed = false;

  private awarenessThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingAwarenessClients = new Set<number>();
  
  private static readonly AWARENESS_THROTTLE_MS = 50;

  constructor(options: TesseraProviderOptions) {
    this.socket = options.socket;
    this.ydoc = options.ydoc;
    this.awareness = options.awareness;

    this.bindSocketListeners();
    this.bindDocListeners();
    this.sendSyncStep1();
  }

  get isSynced(): boolean {
    return this.synced;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.awarenessThrottleTimer) {
      clearTimeout(this.awarenessThrottleTimer);
      this.awarenessThrottleTimer = null;
    }

    this.ydoc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessLocalUpdate);

    this.socket.off("sync-step-1", this.handleSyncStep1);
    this.socket.off("sync-step-2", this.handleSyncStep2);
    this.socket.off("sync-update", this.handleSyncUpdate);
    this.socket.off("awareness-update", this.handleAwarenessRemoteUpdate);
  }

  /**
 * Deletes all content from the shared Monaco text in a single atomic
 * Yjs transaction, propagating the deletion to all synced clients via
 * the existing sync-update socket pipeline.
 */
  clearLocalDoc(): void {
    if (this.destroyed) return;
    const ytext = this.ydoc.getText("monaco");
    if (ytext.length === 0) return;
    this.ydoc.transact(() => {
      ytext.delete(0, ytext.length);
    });
  }

  private sendSyncStep1(): void {
    const stateVector = Y.encodeStateVector(this.ydoc);
    this.socket.emit("sync-step-1", stateVector);
  }

  private bindSocketListeners(): void {
    this.socket.on("sync-step-1", this.handleSyncStep1);
    this.socket.on("sync-step-2", this.handleSyncStep2);
    this.socket.on("sync-update", this.handleSyncUpdate);
    this.socket.on("awareness-update", this.handleAwarenessRemoteUpdate);
  }

  private bindDocListeners(): void {
    this.ydoc.on("update", this.handleDocUpdate);
    this.awareness.on("update", this.handleAwarenessLocalUpdate);
  }

  private readonly handleSyncStep1 = (data: Uint8Array): void => {
    try {
      const update = Y.encodeStateAsUpdate(this.ydoc, new Uint8Array(data));
      this.socket.emit("sync-step-2", update);
    } catch (err: unknown) {
      console.error("[TesseraProvider] sync-step-1 error:", err);
    }
  };

  // Apply updates inside doc.transact with provider origin so y-monaco preserves cursor selections.
  private readonly handleSyncStep2 = (data: Uint8Array): void => {
    try {
      this.ydoc.transact(() => {
        Y.applyUpdate(this.ydoc, new Uint8Array(data), this);
      }, this);
      this.synced = true;
    } catch (err: unknown) {
      console.error("[TesseraProvider] sync-step-2 error:", err);
    }
  };

  private readonly handleSyncUpdate = (data: Uint8Array): void => {
    try {
      this.ydoc.transact(() => {
        Y.applyUpdate(this.ydoc, new Uint8Array(data), this);
      }, this);
    } catch (err: unknown) {
      console.error("[TesseraProvider] sync-update error:", err);
    }
  };

  private readonly handleDocUpdate = (
    update: Uint8Array,
    origin: unknown,
  ): void => {
    if (origin === this) return;
    this.socket.emit("sync-update", update);
  };

  private readonly handleAwarenessLocalUpdate = ({
    added,
    updated,
    removed,
  }: {
    added: number[];
    updated: number[];
    removed: number[];
  }): void => {
    [...added, ...updated, ...removed].forEach((clientId) => {
      this.pendingAwarenessClients.add(clientId);
    });

    if (this.awarenessThrottleTimer) {
      return;
    }

    this.awarenessThrottleTimer = setTimeout(() => {
      const changedClients = [...this.pendingAwarenessClients];

      if (changedClients.length > 0) {
        const encoded = encodeAwarenessUpdate(
          this.awareness,
          changedClients,
        );

        this.socket.emit("awareness-update", encoded);
      }

      this.pendingAwarenessClients.clear();
      this.awarenessThrottleTimer = null;
    }, TesseraSocketProvider.AWARENESS_THROTTLE_MS);
  };

  private readonly handleAwarenessRemoteUpdate = (data: Uint8Array): void => {
    try {
      applyAwarenessUpdate(this.awareness, new Uint8Array(data), this);
    } catch (err: unknown) {
      console.error("[TesseraProvider] awareness-update error:", err);
    }
  };
}