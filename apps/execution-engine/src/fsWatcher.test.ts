import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  FsWatcher,
  isCleanBoundaryIgnored,
  computeContentHash,
  isBinaryBuffer,
  type FsWatchEvent,
} from "./fsWatcher.js";

describe("FsWatcher", () => {
  let tempBaseDir: string;
  let watcher: FsWatcher;

  beforeEach(async () => {
    tempBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "tessera-fswatcher-test-"));
    watcher = new FsWatcher("workspace-test-1", tempBaseDir, {
      debounceMs: 20,
      echoSuppressTtlMs: 200,
    });
  });

  afterEach(async () => {
    await watcher.stop();
    await fs.rm(tempBaseDir, { recursive: true, force: true });
  });

  describe("Clean Boundary Rule", () => {
    it("ignores node_modules and descendant files", () => {
      expect(isCleanBoundaryIgnored("node_modules")).toBe(true);
      expect(isCleanBoundaryIgnored("node_modules/express/index.js")).toBe(true);
      expect(isCleanBoundaryIgnored("src/node_modules/package.json")).toBe(true);
    });

    it("ignores git metadata, npm caches, and build directories", () => {
      expect(isCleanBoundaryIgnored(".git")).toBe(true);
      expect(isCleanBoundaryIgnored(".git/HEAD")).toBe(true);
      expect(isCleanBoundaryIgnored(".npm/_cacache")).toBe(true);
      expect(isCleanBoundaryIgnored("dist/bundle.js")).toBe(true);
      expect(isCleanBoundaryIgnored(".turbo/cache")).toBe(true);
      expect(isCleanBoundaryIgnored(".cache/eslint")).toBe(true);
      expect(isCleanBoundaryIgnored(".DS_Store")).toBe(true);
    });

    it("permits standard application source files and folders", () => {
      expect(isCleanBoundaryIgnored("src/App.tsx")).toBe(false);
      expect(isCleanBoundaryIgnored("src/components/Button.tsx")).toBe(false);
      expect(isCleanBoundaryIgnored("package.json")).toBe(false);
      expect(isCleanBoundaryIgnored("README.md")).toBe(false);
      expect(isCleanBoundaryIgnored("tsconfig.json")).toBe(false);
    });
  });

  describe("Echo-Loop Suppression", () => {
    it("suppresses events for files marked as recent writes with matching content", () => {
      watcher.markRecentWrite("src/App.tsx", "const a = 1;");
      expect(watcher.shouldSuppress("src/App.tsx", "const a = 1;")).toBe(true);
      expect(watcher.shouldSuppress("/src/App.tsx", "const a = 1;")).toBe(false); // Token consumed on previous call!
      expect(watcher.shouldSuppress("src/Other.tsx", "const a = 1;")).toBe(false);
    });

    it("consumes write tokens on first match (one-shot)", () => {
      watcher.markRecentWrite("src/App.tsx", "initial content");
      // First match consumes token
      expect(watcher.shouldSuppress("src/App.tsx", "initial content")).toBe(true);
      // Subsequent edit is NOT suppressed!
      expect(watcher.shouldSuppress("src/App.tsx", "initial content")).toBe(false);
    });

    it("handles empty files correctly without dropping subsequent edits", () => {
      watcher.markRecentWrite("empty.txt", "");
      // Exact hash for empty string is matched and suppressed
      expect(watcher.shouldSuppress("empty.txt", "")).toBe(true);
      // Subsequent edit with non-empty content is NOT suppressed
      expect(watcher.shouldSuppress("empty.txt", "new line")).toBe(false);
    });

    it("expires suppressed writes after TTL has elapsed", async () => {
      watcher.markRecentWrite("src/App.tsx", "content");

      await new Promise((resolve) => {
        setTimeout(resolve, 250);
      });

      expect(watcher.shouldSuppress("src/App.tsx", "content")).toBe(false);
    });

    it("suppresses matching content hash but allows different content writes", () => {
      watcher.markRecentWrite("src/App.tsx", "version-1");
      expect(watcher.shouldSuppress("src/App.tsx", "version-2")).toBe(false);
      expect(watcher.shouldSuppress("src/App.tsx", "version-1")).toBe(true);
    });
  });

  describe("Binary Detection & Hash Helpers", () => {
    it("detects binary buffers with null bytes", () => {
      const textBuf = Buffer.from("Hello world, this is utf-8 text!");
      expect(isBinaryBuffer(textBuf)).toBe(false);

      const binaryBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]);
      expect(isBinaryBuffer(binaryBuf)).toBe(true);
    });

    it("computes deterministic content hashes", () => {
      const hash1 = computeContentHash("sample content");
      const hash2 = computeContentHash("sample content");
      const hashEmpty = computeContentHash("");

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(16);
      expect(hashEmpty.length).toBe(16);
      expect(hash1).not.toBe(hashEmpty);
    });
  });

  describe("Filesystem Event Monitoring", () => {
    it("reports watching state accurately across start and stop", async () => {
      expect(watcher.isWatching()).toBe(false);

      watcher.start();
      expect(watcher.isWatching()).toBe(true);

      await watcher.stop();
      expect(watcher.isWatching()).toBe(false);
    });

    it("detects and dispatches normalized events for added files", async () => {
      const receivedEvents: FsWatchEvent[] = [];
      const unsubscribe = watcher.onEvent((event) => {
        receivedEvents.push(event);
      });

      watcher.start();
      await watcher.waitUntilReady();

      const testFilePath = path.join(tempBaseDir, "hello.txt");
      await fs.writeFile(testFilePath, "Hello Tessera", "utf-8");

      await vi.waitFor(() => {
        expect(receivedEvents.some((e) => e.path === "hello.txt" && e.type === "add")).toBe(true);
      }, { timeout: 3000 });

      unsubscribe();
    });

    it("ignores modifications to files in excluded directories", async () => {
      const receivedEvents: FsWatchEvent[] = [];
      watcher.onEvent((event) => {
        receivedEvents.push(event);
      });

      watcher.start();
      await watcher.waitUntilReady();

      const nodeModulesDir = path.join(tempBaseDir, "node_modules");
      await fs.mkdir(nodeModulesDir, { recursive: true });
      await fs.writeFile(path.join(nodeModulesDir, "test.js"), "console.log(1);", "utf-8");

      await new Promise((resolve) => {
        setTimeout(resolve, 300);
      });

      expect(receivedEvents.some((e) => e.path.includes("node_modules"))).toBe(false);
    });
  });
});
