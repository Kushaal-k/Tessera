export interface PersistenceProvider {
  load(workspaceKey: string): {
    exists: boolean;
    snapshot: Uint8Array | null;
    updates: Uint8Array[];
  };
  storeUpdates(workspaceKey: string, updates: Uint8Array[]): void;
  compact(workspaceKey: string, fullState: Uint8Array): void;
  close(): void;
}
