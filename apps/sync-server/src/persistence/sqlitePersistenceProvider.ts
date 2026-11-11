import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import type { PersistenceProvider } from "./types.js";

const DOC_NAME = "workspace";

interface SnapshotRow {
  snapshot_blob: Buffer;
  last_update_id: number;
}

interface UpdateRow {
  update_blob: Buffer;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wrapStorageError(operation: string, error: unknown): Error {
  return new Error(
    `SQLite persistence ${operation} failed: ${getErrorMessage(error)}`,
    { cause: error },
  );
}

export class SqlitePersistenceProvider implements PersistenceProvider {
  private readonly db!: Database.Database;

  constructor(dbFilePath: string) {
    let database: Database.Database | undefined;

    try {
      if (dbFilePath !== ":memory:") {
        mkdirSync(dirname(resolve(dbFilePath)), { recursive: true });
      }

      database = new Database(dbFilePath);
      this.db = database;
      database.pragma("journal_mode = WAL");
      database.pragma("synchronous = NORMAL");
      database.pragma("foreign_keys = ON");

      database.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS doc_updates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id),
          doc_name TEXT NOT NULL,
          update_blob BLOB NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS doc_snapshots (
          workspace_id TEXT NOT NULL REFERENCES workspaces(id),
          doc_name TEXT NOT NULL,
          snapshot_blob BLOB NOT NULL,
          last_update_id INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (workspace_id, doc_name)
        );
      `);

      database.exec(`
        CREATE INDEX IF NOT EXISTS doc_updates_workspace_document_id
        ON doc_updates(workspace_id, doc_name, id);
      `);
    } catch (error: unknown) {
      if (database?.open) {
        database.close();
      }
      throw wrapStorageError("open", error);
    }
  }

  load(workspaceKey: string): {
    exists: boolean;
    snapshot: Uint8Array | null;
    updates: Uint8Array[];
  } {
    validateWorkspaceKey(workspaceKey);

    try {
      const workspace = this.db
        .prepare("SELECT id FROM workspaces WHERE id = ?")
        .get(workspaceKey);
      const snapshot = this.db
        .prepare(
          `SELECT snapshot_blob, last_update_id
           FROM doc_snapshots
           WHERE workspace_id = ? AND doc_name = ?`,
        )
        .get(workspaceKey, DOC_NAME) as SnapshotRow | undefined;
      const lastUpdateId = snapshot?.last_update_id ?? 0;
      const updates = this.db
        .prepare(
          `SELECT update_blob
           FROM doc_updates
           WHERE workspace_id = ? AND doc_name = ? AND id > ?
           ORDER BY id`,
        )
        .all(workspaceKey, DOC_NAME, lastUpdateId) as UpdateRow[];

      return {
        exists: workspace !== undefined,
        snapshot: snapshot ? new Uint8Array(snapshot.snapshot_blob) : null,
        updates: updates.map((row) => new Uint8Array(row.update_blob)),
      };
    } catch (error: unknown) {
      throw wrapStorageError("load", error);
    }
  }

  storeUpdates(workspaceKey: string, updates: Uint8Array[]): void {
    validateWorkspaceKey(workspaceKey);

    try {
      const now = Date.now();
      const ensureWorkspace = this.db.prepare(
        `INSERT INTO workspaces (id, created_at, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`,
      );
      const insertUpdate = this.db.prepare(
        `INSERT INTO doc_updates (workspace_id, doc_name, update_blob, created_at)
         VALUES (?, ?, ?, ?)`,
      );
      const transaction = this.db.transaction(
        (key: string, batch: Uint8Array[]) => {
          ensureWorkspace.run(key, now, now);
          for (const update of batch) {
            insertUpdate.run(key, DOC_NAME, Buffer.from(update), now);
          }
        },
      );

      transaction(workspaceKey, updates);
    } catch (error: unknown) {
      throw wrapStorageError("storeUpdates", error);
    }
  }

  compact(workspaceKey: string, fullState: Uint8Array): void {
    validateWorkspaceKey(workspaceKey);

    try {
      const ensureWorkspace = this.db.prepare(
        `INSERT INTO workspaces (id, created_at, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`,
      );
      const getLastUpdateId = this.db.prepare(
        `SELECT COALESCE(MAX(id), 0) AS last_update_id
         FROM doc_updates
         WHERE workspace_id = ? AND doc_name = ?`,
      );
      const saveSnapshot = this.db.prepare(
        `INSERT INTO doc_snapshots
           (workspace_id, doc_name, snapshot_blob, last_update_id, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id, doc_name) DO UPDATE SET
           snapshot_blob = excluded.snapshot_blob,
           last_update_id = excluded.last_update_id,
           updated_at = excluded.updated_at`,
      );
      const deleteUpdates = this.db.prepare(
        `DELETE FROM doc_updates
         WHERE workspace_id = ? AND doc_name = ? AND id <= ?`,
      );
      const transaction = this.db.transaction((key: string, state: Uint8Array) => {
        const now = Date.now();
        ensureWorkspace.run(key, now, now);
        const row = getLastUpdateId.get(key, DOC_NAME) as {
          last_update_id: number;
        };
        // Saving the checkpoint and pruning its covered updates must be atomic.
        saveSnapshot.run(key, DOC_NAME, Buffer.from(state), row.last_update_id, now);
        deleteUpdates.run(key, DOC_NAME, row.last_update_id);
      });

      transaction(workspaceKey, fullState);
    } catch (error: unknown) {
      throw wrapStorageError("compact", error);
    }
  }

  close(): void {
    try {
      this.db.close();
    } catch (error: unknown) {
      throw wrapStorageError("close", error);
    }
  }
}

function validateWorkspaceKey(workspaceKey: string): void {
  if (
    typeof workspaceKey !== "string" ||
    workspaceKey.length === 0 ||
    workspaceKey.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(workspaceKey)
  ) {
    throw new Error(
      "Invalid workspaceKey: expected 1-128 characters containing only letters, numbers, underscores, or hyphens",
    );
  }
}
