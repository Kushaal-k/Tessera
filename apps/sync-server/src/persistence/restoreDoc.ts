import * as Y from "yjs";
import type { PersistenceProvider } from "./types.js";

export function restoreDoc(
  provider: PersistenceProvider,
  workspaceKey: string,
): { doc: Y.Doc; exists: boolean } {
  const stored = provider.load(workspaceKey);
  const doc = new Y.Doc();

  try {
    if (stored.snapshot) {
      // Persistence-originated changes must not be written back as new updates.
      Y.applyUpdate(doc, stored.snapshot, "persistence");
    }
    for (const update of stored.updates) {
      Y.applyUpdate(doc, update, "persistence");
    }

    return { doc, exists: stored.exists };
  } catch (error: unknown) {
    doc.destroy();
    throw error;
  }
}
