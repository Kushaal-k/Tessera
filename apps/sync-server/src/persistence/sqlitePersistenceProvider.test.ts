import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import * as Y from "yjs";
import { restoreDoc } from "./restoreDoc.js";
import { SqlitePersistenceProvider } from "./sqlitePersistenceProvider.js";

let tempDirectory: string;
const providers: SqlitePersistenceProvider[] = [];
const closedProviders = new Set<SqlitePersistenceProvider>();
const docs: Y.Doc[] = [];

function createProvider(): SqlitePersistenceProvider {
  const provider = new SqlitePersistenceProvider(join(tempDirectory, "workspace.db"));
  providers.push(provider);
  return provider;
}

function createDoc(): Y.Doc {
  const doc = new Y.Doc();
  docs.push(doc);
  return doc;
}

function closeProvider(provider: SqlitePersistenceProvider): void {
  provider.close();
  closedProviders.add(provider);
}

beforeEach(() => {
  tempDirectory = mkdtempSync(join(tmpdir(), "tessera-persistence-"));
});

afterEach(() => {
  for (const provider of providers) {
    if (!closedProviders.has(provider)) {
      provider.close();
    }
  }
  providers.length = 0;
  closedProviders.clear();

  for (const doc of docs) {
    doc.destroy();
  }
  docs.length = 0;
  rmSync(tempDirectory, { recursive: true, force: true });
});

describe("SqlitePersistenceProvider", () => {
  it("restores Yjs map and text state from a new provider", () => {
    const workspaceKey = "workspace-restore";
    const provider = createProvider();
    const source = createDoc();
    source.getMap("settings").set("theme", "dark");
    source.getText("content").insert(0, "persisted text");
    provider.storeUpdates(workspaceKey, [Y.encodeStateAsUpdate(source)]);
    closeProvider(provider);

    const reopenedProvider = createProvider();
    const { doc: restored, exists } = restoreDoc(reopenedProvider, workspaceKey);
    docs.push(restored);

    expect(exists).toBe(true);
    expect(restored.getMap("settings").get("theme")).toBe("dark");
    expect(restored.getText("content").toString()).toBe("persisted text");
    expect(Array.from(Y.encodeStateVector(restored))).toEqual(
      Array.from(Y.encodeStateVector(source)),
    );
  });

  it("restores an unknown workspace as empty and not seeded", () => {
    const { doc, exists } = restoreDoc(createProvider(), "unknown-workspace");
    docs.push(doc);

    expect(exists).toBe(false);
    expect(doc.getMap("settings").size).toBe(0);
    expect(doc.getText("content").length).toBe(0);
  });

  it("keeps an empty seeded workspace distinguishable from an unknown one", () => {
    const provider = createProvider();
    provider.storeUpdates("seeded-workspace", []);

    expect(provider.load("seeded-workspace")).toEqual({
      exists: true,
      snapshot: null,
      updates: [],
    });
  });

  it("restores concurrent edits from multiple Y.Docs", () => {
    const provider = createProvider();
    const first = createDoc();
    const second = createDoc();
    first.getMap("items").set("first", "one");
    second.getMap("items").set("second", "two");

    provider.storeUpdates("concurrent-workspace", [
      Y.encodeStateAsUpdate(first),
      Y.encodeStateAsUpdate(second),
    ]);

    const { doc: restored } = restoreDoc(provider, "concurrent-workspace");
    docs.push(restored);
    expect(Object.fromEntries(restored.getMap("items").entries())).toEqual({
      first: "one",
      second: "two",
    });
  });

  it("compacts atomically and accepts updates after the snapshot", () => {
    const provider = createProvider();
    const source = createDoc();
    source.getMap("settings").set("theme", "dark");
    source.getText("content").insert(0, "before compaction");
    provider.storeUpdates("compact-workspace", [Y.encodeStateAsUpdate(source)]);
    provider.compact("compact-workspace", Y.encodeStateAsUpdate(source));

    const inspectionDb = new Database(join(tempDirectory, "workspace.db"));
    try {
      const { count } = inspectionDb
        .prepare(
          "SELECT COUNT(*) AS count FROM doc_updates WHERE workspace_id = ?",
        )
        .get("compact-workspace") as { count: number };
      expect(count).toBe(0);
    } finally {
      inspectionDb.close();
    }

    const { doc: compacted } = restoreDoc(provider, "compact-workspace");
    docs.push(compacted);
    expect(compacted.getMap("settings").get("theme")).toBe("dark");
    expect(compacted.getText("content").toString()).toBe("before compaction");
    expect(Array.from(Y.encodeStateVector(compacted))).toEqual(
      Array.from(Y.encodeStateVector(source)),
    );

    const stateVector = Y.encodeStateVector(source);
    source.getText("content").insert(source.getText("content").length, " and after");
    provider.storeUpdates("compact-workspace", [
      Y.encodeStateAsUpdate(source, stateVector),
    ]);

    closeProvider(provider);
    const reopenedProvider = createProvider();
    const { doc: updated } = restoreDoc(reopenedProvider, "compact-workspace");
    docs.push(updated);
    expect(updated.getText("content").toString()).toBe(
      "before compaction and after",
    );
    expect(Array.from(Y.encodeStateVector(updated))).toEqual(
      Array.from(Y.encodeStateVector(source)),
    );
  });

  it("rejects workspace keys outside the allowed format", () => {
    const provider = createProvider();
    for (const workspaceKey of [
      "",
      "a".repeat(129),
      "has spaces",
      "non-ascii-é",
      "slash/key",
    ]) {
      expect(() => provider.load(workspaceKey)).toThrow(/Invalid workspaceKey/);
    }
  });

  it("does not share data between workspace keys", () => {
    const provider = createProvider();
    const first = createDoc();
    const second = createDoc();
    first.getMap("items").set("secret", "first");
    second.getMap("items").set("secret", "second");
    provider.storeUpdates("workspace-one", [Y.encodeStateAsUpdate(first)]);
    provider.storeUpdates("workspace-two", [Y.encodeStateAsUpdate(second)]);

    const restoredFirst = restoreDoc(provider, "workspace-one").doc;
    const restoredSecond = restoreDoc(provider, "workspace-two").doc;
    docs.push(restoredFirst, restoredSecond);
    expect(restoredFirst.getMap("items").get("secret")).toBe("first");
    expect(restoredSecond.getMap("items").get("secret")).toBe("second");
  });

  it("reports closed-database failures without damaging stored data", () => {
    const workspaceKey = "failure-workspace";
    const provider = createProvider();
    const source = createDoc();
    source.getMap("settings").set("theme", "dark");
    provider.storeUpdates(workspaceKey, [Y.encodeStateAsUpdate(source)]);
    closeProvider(provider);

    expect(() =>
      provider.storeUpdates(workspaceKey, [new Uint8Array([1])]),
    ).toThrow(/storeUpdates failed:.*database connection is not open/i);

    const reopenedProvider = createProvider();
    const { doc: restored } = restoreDoc(reopenedProvider, workspaceKey);
    docs.push(restored);
    expect(restored.getMap("settings").get("theme")).toBe("dark");
  });
});
