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

  describe("symlink containment and race condition security", () => {
    let outsideDir: string;

    beforeEach(async () => {
      outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "tessera-outside-victim-"));
    });

    afterEach(async () => {
      await fs.rm(outsideDir, { recursive: true, force: true });
    });

    it("handles normal nested paths for read, write, directory creation, rename, and deletion", async () => {
      const workspaceId = "room-test-nested";
      await storage.initWorkspace(workspaceId);

      await storage.createFolder(workspaceId, "src/components");
      await storage.writeFiles(workspaceId, [
        { path: "src/components/Header.tsx", content: "export const Header = () => null;" },
      ]);

      const content = await storage.readFile(workspaceId, "src/components/Header.tsx");
      expect(content).toBe("export const Header = () => null;");

      await storage.renamePath(
        workspaceId,
        "src/components/Header.tsx",
        "src/components/MainHeader.tsx"
      );

      const renamedContent = await storage.readFile(workspaceId, "src/components/MainHeader.tsx");
      expect(renamedContent).toBe("export const Header = () => null;");

      expect(
        await storage.checkSymlinkContainment(workspaceId, "src/components/MainHeader.tsx")
      ).toBe(true);

      await storage.deletePath(workspaceId, "src/components/MainHeader.tsx");
      await expect(storage.readFile(workspaceId, "src/components/MainHeader.tsx")).rejects.toThrow();
    });

    it("rejects operations with an external symlink ancestor and protects outside files", async () => {
      const workspaceId = "room-test-ext-ancestor";
      await storage.initWorkspace(workspaceId);

      const canaryPath = path.join(outsideDir, "canary.txt");
      await fs.writeFile(canaryPath, "CANARY ORIGINAL DATA", "utf-8");

      const workspacePath = storage.getWorkspacePath(workspaceId);
      const symlinkAncestor = path.join(workspacePath, "ext_ancestor");
      await fs.symlink(outsideDir, symlinkAncestor);

      expect(
        await storage.checkSymlinkContainment(workspaceId, "ext_ancestor/canary.txt")
      ).toBe(false);

      await expect(
        storage.readFile(workspaceId, "ext_ancestor/canary.txt")
      ).rejects.toThrow("Path traversal attempt detected");

      await expect(
        storage.writeFiles(workspaceId, [
          { path: "ext_ancestor/canary.txt", content: "MALICIOUS OVERWRITE" },
        ])
      ).rejects.toThrow("Path traversal attempt detected");

      await expect(
        storage.createFolder(workspaceId, "ext_ancestor/forbidden_folder")
      ).rejects.toThrow("Path traversal attempt detected");

      await expect(
        storage.deletePath(workspaceId, "ext_ancestor/canary.txt")
      ).rejects.toThrow("Path traversal attempt detected");

      await expect(
        storage.renamePath(workspaceId, "ext_ancestor/canary.txt", "safe.txt")
      ).rejects.toThrow("Path traversal attempt detected");

      await storage.writeFiles(workspaceId, [{ path: "safe.txt", content: "safe" }]);
      await expect(
        storage.renamePath(workspaceId, "safe.txt", "ext_ancestor/safe.txt")
      ).rejects.toThrow("Path traversal attempt detected");

      const canaryContentAfter = await fs.readFile(canaryPath, "utf-8");
      expect(canaryContentAfter).toBe("CANARY ORIGINAL DATA");

      const outsideFiles = await fs.readdir(outsideDir);
      expect(outsideFiles).toEqual(["canary.txt"]);
    });

    it("rejects operations targeting an escaping symlink target and protects outside files", async () => {
      const workspaceId = "room-test-escaping-target";
      await storage.initWorkspace(workspaceId);

      const outsideFilePath = path.join(outsideDir, "secret.txt");
      await fs.writeFile(outsideFilePath, "TOP SECRET DATA", "utf-8");

      const workspacePath = storage.getWorkspacePath(workspaceId);
      const linkPath = path.join(workspacePath, "escaping_link.txt");
      await fs.symlink(outsideFilePath, linkPath);

      expect(
        await storage.checkSymlinkContainment(workspaceId, "escaping_link.txt")
      ).toBe(false);

      await expect(
        storage.readFile(workspaceId, "escaping_link.txt")
      ).rejects.toThrow("Path traversal attempt detected");

      await expect(
        storage.writeFiles(workspaceId, [
          { path: "escaping_link.txt", content: "CORRUPTED DATA" },
        ])
      ).rejects.toThrow("Path traversal attempt detected");

      await expect(
        storage.renamePath(workspaceId, "escaping_link.txt", "moved.txt")
      ).rejects.toThrow("Path traversal attempt detected");

      await storage.writeFiles(workspaceId, [{ path: "source.txt", content: "source" }]);
      await expect(
        storage.renamePath(workspaceId, "source.txt", "escaping_link.txt")
      ).rejects.toThrow("Path traversal attempt detected");

      const outsideContentAfter = await fs.readFile(outsideFilePath, "utf-8");
      expect(outsideContentAfter).toBe("TOP SECRET DATA");
    });

    it("rejects operations encountering a broken symlink", async () => {
      const workspaceId = "room-test-broken-link";
      await storage.initWorkspace(workspaceId);

      const workspacePath = storage.getWorkspacePath(workspaceId);
      const brokenTarget = path.join(tempBaseDir, "nonexistent-target-12345");
      const brokenLink = path.join(workspacePath, "broken_link");
      await fs.symlink(brokenTarget, brokenLink);

      expect(
        await storage.checkSymlinkContainment(workspaceId, "broken_link")
      ).toBe(false);

      expect(
        await storage.checkSymlinkContainment(workspaceId, "broken_link/sub.txt")
      ).toBe(false);

      await expect(
        storage.readFile(workspaceId, "broken_link")
      ).rejects.toThrow("broken symlink");

      await expect(
        storage.writeFiles(workspaceId, [
          { path: "broken_link", content: "content" },
        ])
      ).rejects.toThrow("broken symlink");

      await expect(
        storage.readFile(workspaceId, "broken_link/sub.txt")
      ).rejects.toThrow("broken symlink");

      await expect(
        storage.writeFiles(workspaceId, [
          { path: "broken_link/sub.txt", content: "content" },
        ])
      ).rejects.toThrow("broken symlink");

      await expect(
        storage.createFolder(workspaceId, "broken_link/subfolder")
      ).rejects.toThrow("broken symlink");

      await expect(
        storage.deletePath(workspaceId, "broken_link/sub.txt")
      ).rejects.toThrow("broken symlink");

      await expect(
        storage.renamePath(workspaceId, "broken_link", "dest")
      ).rejects.toThrow("broken symlink");
    });

    it("prevents workspace root deletion and operations on workspace root", async () => {
      const workspaceId = "room-test-root-protection";
      await storage.initWorkspace(workspaceId);

      await expect(
        storage.deletePath(workspaceId, "")
      ).rejects.toThrow("Cannot delete workspace root directory via deletePath");

      await expect(
        storage.deletePath(workspaceId, ".")
      ).rejects.toThrow("Cannot delete workspace root directory via deletePath");

      await expect(
        storage.deletePath(workspaceId, "sub/../.")
      ).rejects.toThrow("escapes workspace boundary");

      await expect(
        storage.renamePath(workspaceId, ".", "dest")
      ).rejects.toThrow("Cannot operate on workspace root directory");

      await expect(
        storage.renamePath(workspaceId, "file.txt", ".")
      ).rejects.toThrow("Cannot operate on workspace root directory");

      expect(await storage.isWorkspaceInitialized(workspaceId)).toBe(true);
    });

    it("defends against concurrent path replacement and guarantees outside files are never read or modified", async () => {
      const workspaceId = "room-test-concurrent-race";
      await storage.initWorkspace(workspaceId);

      const canaryPath = path.join(outsideDir, "canary.txt");
      await fs.writeFile(canaryPath, "CRITICAL UNTOUCHED CANARY", "utf-8");

      const workspacePath = storage.getWorkspacePath(workspaceId);
      const racedDir = path.join(workspacePath, "raced_dir");
      await fs.mkdir(racedDir);

      let stop = false;
      const swapperPromise = (async () => {
        while (!stop) {
          try {
            await fs.rm(racedDir, { recursive: true, force: true });
            await fs.symlink(outsideDir, racedDir);
            await new Promise((resolve) => {
              setTimeout(resolve, 1);
            });
            await fs.rm(racedDir, { recursive: true, force: true });
            await fs.mkdir(racedDir);
            await new Promise((resolve) => {
              setTimeout(resolve, 1);
            });
          } catch {
            // Concurrency error during swap
          }
        }
      })();

      const operations: Promise<void>[] = [];
      for (let i = 0; i < 30; i++) {
        operations.push(
          (async () => {
            try {
              await storage.writeFiles(workspaceId, [
                { path: "raced_dir/canary.txt", content: "ATTACK RACE WRITE" },
              ]);
            } catch {
              // Expected to fail safely when symlink is present
            }

            try {
              const data = await storage.readFile(workspaceId, "raced_dir/canary.txt");
              expect(data).not.toBe("CRITICAL UNTOUCHED CANARY");
            } catch {
              // Expected to fail safely when symlink is present
            }
          })()
        );
      }

      await Promise.all(operations);
      stop = true;
      await swapperPromise;

      const canaryContentAfter = await fs.readFile(canaryPath, "utf-8");
      expect(canaryContentAfter).toBe("CRITICAL UNTOUCHED CANARY");

      const outsideFiles = await fs.readdir(outsideDir);
      expect(outsideFiles).toEqual(["canary.txt"]);
    });
  });
});

