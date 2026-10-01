import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { WorkspaceStorage } from "./workspaceStorage.js";

describe("WorkspaceStorage", () => {
  let tempBaseDir: string;
  let storage: WorkspaceStorage;

  beforeEach(async () => {
    tempBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "tessera-storage-test-"));
    storage = new WorkspaceStorage({ baseDir: tempBaseDir });
  });

  afterEach(async () => {
    await fs.rm(tempBaseDir, { recursive: true, force: true });
  });

  describe("workspaceId validation", () => {
    it("allows valid alphanumeric, hyphenated, and underscored workspace IDs", () => {
      expect(() => {
        storage.validateWorkspaceId("workspace-123_abc");
      }).not.toThrow();
    });

    it("throws on empty or non-string workspace IDs", () => {
      expect(() => {
        storage.validateWorkspaceId("");
      }).toThrow("Invalid workspace ID");
    });

    it("blocks directory traversal attempts in workspace IDs", () => {
      expect(() => {
        storage.validateWorkspaceId("../traversal");
      }).toThrow("Invalid workspace ID");
      expect(() => {
        storage.validateWorkspaceId("dir/sub");
      }).toThrow("Invalid workspace ID");
      expect(() => {
        storage.validateWorkspaceId("workspace;rm -rf");
      }).toThrow("Invalid workspace ID");
    });
  });

  describe("workspace lifecycle and file management", () => {
    it("reports workspace as uninitialized before init and initialized after init", async () => {
      const workspaceId = "room-test-1";
      expect(await storage.isWorkspaceInitialized(workspaceId)).toBe(false);

      const createdPath = await storage.initWorkspace(workspaceId);
      expect(createdPath).toBe(path.join(tempBaseDir, workspaceId));
      expect(await storage.isWorkspaceInitialized(workspaceId)).toBe(true);
    });

    it("seeds initial files with subdirectories on initialization", async () => {
      const workspaceId = "room-test-2";
      const files = [
        { path: "package.json", content: '{"name": "test-project"}' },
        { path: "src/index.js", content: 'console.log("hello");' },
        { path: "nested/deep/config.json", content: '{"active": true}' },
      ];

      await storage.initWorkspace(workspaceId, files);

      const pkgContent = await fs.readFile(
        path.join(tempBaseDir, workspaceId, "package.json"),
        "utf-8"
      );
      const srcContent = await fs.readFile(
        path.join(tempBaseDir, workspaceId, "src", "index.js"),
        "utf-8"
      );
      const deepContent = await fs.readFile(
        path.join(tempBaseDir, workspaceId, "nested", "deep", "config.json"),
        "utf-8"
      );

      expect(pkgContent).toBe('{"name": "test-project"}');
      expect(srcContent).toBe('console.log("hello");');
      expect(deepContent).toBe('{"active": true}');
    });

    it("rejects path traversal attempts within file paths", async () => {
      const workspaceId = "room-test-3";
      await storage.initWorkspace(workspaceId);

      await expect(
        storage.writeFiles(workspaceId, [{ path: "../outside.txt", content: "malicious" }])
      ).rejects.toThrow("Path traversal attempt detected");

      await expect(
        storage.writeFiles(workspaceId, [{ path: "/etc/passwd", content: "malicious" }])
      ).rejects.toThrow("Path traversal attempt detected");
    });

    it("deletes the workspace directory and all its contents", async () => {
      const workspaceId = "room-test-4";
      await storage.initWorkspace(workspaceId, [
        { path: "file.txt", content: "content" },
      ]);

      expect(await storage.isWorkspaceInitialized(workspaceId)).toBe(true);

      await storage.deleteWorkspace(workspaceId);
      expect(await storage.isWorkspaceInitialized(workspaceId)).toBe(false);
    });

    it("enforces strict path traversal prevention in resolveSafePath", async () => {
      const workspaceId = "room-test-security";
      await storage.initWorkspace(workspaceId);

      expect(() => storage.resolveSafePath(workspaceId, "../../etc/passwd")).toThrow(
        "Path traversal attempt detected"
      );
      expect(() => storage.resolveSafePath(workspaceId, "/var/log/test")).toThrow(
        "Path traversal attempt detected"
      );
      expect(() => storage.resolveSafePath(workspaceId, "test\0file.txt")).toThrow(
        "Path traversal attempt detected: null byte in path"
      );
      expect(() => storage.resolveSafePath(workspaceId, "")).toThrow(
        "Invalid file path: path must be a non-empty string"
      );
    });

    it("safely creates nested folders and deletes specific files within workspace", async () => {
      const workspaceId = "room-test-safe-delete";
      await storage.initWorkspace(workspaceId);

      await storage.createFolder(workspaceId, "nested/subfolder");
      await storage.writeFiles(workspaceId, [
        { path: "nested/subfolder/target.txt", content: "delete me" },
      ]);

      const targetPath = storage.resolveSafePath(workspaceId, "nested/subfolder/target.txt");
      expect(await fs.readFile(targetPath, "utf-8")).toBe("delete me");

      await storage.deletePath(workspaceId, "nested/subfolder/target.txt");
      await expect(fs.readFile(targetPath, "utf-8")).rejects.toThrow();

      // Ensure deleting traversal or workspace root itself is blocked
      await expect(storage.deletePath(workspaceId, "../escape")).rejects.toThrow(
        "Path traversal attempt detected"
      );
    });
  });
});

