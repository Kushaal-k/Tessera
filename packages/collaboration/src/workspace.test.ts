import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import {
  Workspace,
  createWorkspace,
  WORKSPACE_KEYS,
  detectLanguage,
} from "./workspace.js";
import type { WorkspaceFolder } from "@tessera/shared-types";

describe("Workspace Model", () => {
  describe("Creation", () => {
    it("creates a new workspace with specified metadata", () => {
      const workspace = createWorkspace({
        id: "ws-1",
        name: "Test Workspace",
        description: "A test workspace",
      });

      expect(workspace).toBeInstanceOf(Workspace);
      expect(workspace.doc).toBeInstanceOf(Y.Doc);

      const metadata = workspace.getMetadata();
      expect(metadata.id).toBe("ws-1");
      expect(metadata.name).toBe("Test Workspace");
      expect(metadata.description).toBe("A test workspace");
      expect(metadata.createdAt).toBeDefined();
      expect(metadata.updatedAt).toBeDefined();
    });

    it("wraps an existing Y.Doc without overwriting existing metadata", () => {
      const doc = new Y.Doc();
      const metadataMap = doc.getMap(WORKSPACE_KEYS.METADATA);
      metadataMap.set("id", "existing-id");
      metadataMap.set("name", "Existing Name");
      metadataMap.set("createdAt", "2026-01-01T00:00:00.000Z");
      metadataMap.set("updatedAt", "2026-01-01T00:00:00.000Z");

      const workspace = new Workspace(
        { id: "ignored-id", name: "Ignored Name" },
        doc,
      );

      const metadata = workspace.getMetadata();
      expect(metadata.id).toBe("existing-id");
      expect(metadata.name).toBe("Existing Name");
      expect(metadata.createdAt).toBe("2026-01-01T00:00:00.000Z");
    });
  });

  describe("Metadata Management", () => {
    it("updates workspace metadata fields", () => {
      const workspace = createWorkspace({
        id: "ws-meta",
        name: "Initial Name",
      });

      workspace.updateMetadata({
        name: "Renamed Workspace",
        description: "Added description",
      });

      const metadata = workspace.getMetadata();
      expect(metadata.name).toBe("Renamed Workspace");
      expect(metadata.description).toBe("Added description");
    });

    it("notifies listeners when metadata changes and respects unsubscription", () => {
      const workspace = createWorkspace({
        id: "ws-obs",
        name: "Observable Workspace",
      });

      const listener = vi.fn();
      const unsubscribe = workspace.onMetadataChanged(listener);

      workspace.updateMetadata({ name: "Updated 1" });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated 1" }),
      );

      unsubscribe();
      workspace.updateMetadata({ name: "Updated 2" });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("Language Detection", () => {
    it("detects programming languages by extension", () => {
      expect(detectLanguage("index.ts")).toBe("typescript");
      expect(detectLanguage("App.tsx")).toBe("typescript");
      expect(detectLanguage("script.js")).toBe("javascript");
      expect(detectLanguage("server.mjs")).toBe("javascript");
      expect(detectLanguage("main.py")).toBe("python");
      expect(detectLanguage("main.go")).toBe("go");
      expect(detectLanguage("lib.rs")).toBe("rust");
      expect(detectLanguage("Main.java")).toBe("java");
      expect(detectLanguage("main.cpp")).toBe("cpp");
      expect(detectLanguage("data.json")).toBe("json");
      expect(detectLanguage("index.html")).toBe("html");
      expect(detectLanguage("style.css")).toBe("css");
      expect(detectLanguage("README.md")).toBe("markdown");
      expect(detectLanguage("file_without_ext")).toBe("plaintext");
      expect(detectLanguage("unknown.xyz")).toBe("plaintext");
    });
  });

  describe("File Management (Issue #513)", () => {
    it("creates a file with auto-detected language and initial content", () => {
      const workspace = createWorkspace({ id: "ws-file-mgmt", name: "File WS" });

      const result = workspace.createFile("main.py", {
        initialContent: "print('hello')",
      });

      expect(result.success).toBe(true);
      expect(result.file).toBeDefined();
      expect(result.file?.name).toBe("main.py");
      expect(result.file?.language).toBe("python");
      expect(result.file?.parentId).toBeNull();
      expect(result.file?.size).toBe("print('hello')".length);

      const content = workspace.getFileContent(result.file!.id);
      expect(content).toBe("print('hello')");
    });

    it("rejects empty file names", () => {
      const workspace = createWorkspace({ id: "ws-empty", name: "Empty WS" });

      const result = workspace.createFile("   ");
      expect(result.success).toBe(false);
      expect(result.error).toBe("File name cannot be empty");
      expect(workspace.getFiles()).toHaveLength(0);
    });

    it("prevents duplicate file names within the same parent folder", () => {
      const workspace = createWorkspace({ id: "ws-dup", name: "Dup WS" });

      const first = workspace.createFile("index.ts");
      expect(first.success).toBe(true);

      const duplicate = workspace.createFile("index.ts");
      expect(duplicate.success).toBe(false);
      expect(duplicate.error).toBe("Duplicate file in folder");
      expect(workspace.getFiles()).toHaveLength(1);
    });

    it("allows same file name in different parent folders", () => {
      const workspace = createWorkspace({ id: "ws-diff-folder", name: "Diff WS" });
      workspace.setFolder({
        id: "folder-1",
        name: "src",
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const rootFile = workspace.createFile("index.ts", { parentId: null });
      const folderFile = workspace.createFile("index.ts", { parentId: "folder-1" });

      expect(rootFile.success).toBe(true);
      expect(folderFile.success).toBe(true);
      expect(workspace.getFiles()).toHaveLength(2);
    });

    it("deletes a file and clears its text buffer", () => {
      const workspace = createWorkspace({ id: "ws-del", name: "Del WS" });
      const created = workspace.createFile("temp.ts", {
        initialContent: "const x = 1;",
      });
      const fileId = created.file!.id;

      expect(workspace.hasFile(fileId)).toBe(true);
      expect(workspace.getFileContent(fileId)).toBe("const x = 1;");

      const deleted = workspace.deleteFile(fileId);
      expect(deleted).toBe(true);
      expect(workspace.hasFile(fileId)).toBe(false);
      expect(workspace.getFile(fileId)).toBeUndefined();
      expect(workspace.getFileContent(fileId)).toBeUndefined();

      expect(workspace.deleteFile(fileId)).toBe(false);
    });

    it("updates file content and updates metadata size and updatedAt", () => {
      const workspace = createWorkspace({ id: "ws-update", name: "Update WS" });
      const created = workspace.createFile("doc.txt", {
        initialContent: "Initial content",
      });
      const fileId = created.file!.id;

      const updated = workspace.updateFileContent(fileId, "New content updated");

      expect(updated).toBe(true);

      expect(workspace.getFileContent(fileId)).toBe("New content updated");
      const file = workspace.getFile(fileId);
      expect(file?.size).toBe("New content updated".length);
      expect(file?.updatedAt).toBeDefined();

      const nonExistent = workspace.updateFileContent("invalid-id", "test");
      expect(nonExistent).toBe(false);
    });

    it("renames a file and prevents duplicate names in the same folder", () => {
      const workspace = createWorkspace({ id: "ws-rename", name: "Rename WS" });
      const file1 = workspace.createFile("old_name.ts")!.file!;
      workspace.createFile("existing.ts");

      const renameToDuplicate = workspace.renameFile(file1.id, "existing.ts");
      expect(renameToDuplicate.success).toBe(false);
      expect(renameToDuplicate.error).toBe("Duplicate file in folder");

      const renameToEmpty = workspace.renameFile(file1.id, "   ");
      expect(renameToEmpty.success).toBe(false);
      expect(renameToEmpty.error).toBe("File name cannot be empty");

      const validRename = workspace.renameFile(file1.id, "new_name.py");
      expect(validRename.success).toBe(true);
      expect(validRename.file?.name).toBe("new_name.py");
      expect(validRename.file?.language).toBe("python");
      expect(workspace.getFile(file1.id)?.name).toBe("new_name.py");
    });

    it("moves a file to another folder and prevents destination name collisions", () => {
      const workspace = createWorkspace({ id: "ws-move", name: "Move WS" });
      workspace.setFolder({
        id: "folder-target",
        name: "target",
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const file = workspace.createFile("app.ts")!.file!;
      workspace.createFile("app.ts", { parentId: "folder-target" });

      const moveCollision = workspace.moveFile(file.id, "folder-target");
      expect(moveCollision.success).toBe(false);
      expect(moveCollision.error).toContain("already exists in target folder");

      const moveNonExistentFolder = workspace.moveFile(file.id, "missing-folder");
      expect(moveNonExistentFolder.success).toBe(false);
      expect(moveNonExistentFolder.error).toBe("Target folder does not exist");

      workspace.deleteFile(workspace.getFiles().find(f => f.parentId === "folder-target")!.id);

      const validMove = workspace.moveFile(file.id, "folder-target");
      expect(validMove.success).toBe(true);
      expect(validMove.file?.parentId).toBe("folder-target");
      expect(workspace.getFile(file.id)?.parentId).toBe("folder-target");
    });
  });

  describe("Folder Storage", () => {
    it("stores, retrieves, checks, and lists folders", () => {
      const workspace = createWorkspace({ id: "ws-folders", name: "Folders WS" });

      const folder1: WorkspaceFolder = {
        id: "folder-1",
        name: "src",
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const folder2: WorkspaceFolder = {
        id: "folder-2",
        name: "components",
        parentId: "folder-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      workspace.setFolder(folder1);
      workspace.setFolder(folder2);

      expect(workspace.hasFolder("folder-1")).toBe(true);
      expect(workspace.hasFolder("folder-2")).toBe(true);
      expect(workspace.hasFolder("folder-nonexistent")).toBe(false);

      expect(workspace.getFolder("folder-1")).toEqual(folder1);
      expect(workspace.getFolder("folder-2")).toEqual(folder2);

      const allFolders = workspace.getFolders();
      expect(allFolders).toHaveLength(2);
      expect(allFolders).toEqual(expect.arrayContaining([folder1, folder2]));
    });

    it("deletes folders from the workspace", () => {
      const workspace = createWorkspace({ id: "ws-folders", name: "Folders WS" });

      const folder: WorkspaceFolder = {
        id: "folder-del",
        name: "temp",
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      workspace.setFolder(folder);
      expect(workspace.hasFolder("folder-del")).toBe(true);

      const deleted = workspace.deleteFolder("folder-del");
      expect(deleted).toBe(true);
      expect(workspace.hasFolder("folder-del")).toBe(false);
      expect(workspace.deleteFolder("folder-del")).toBe(false);
    });

    it("notifies listeners on folder changes", () => {
      const workspace = createWorkspace({ id: "ws-folders-obs", name: "Obs WS" });

      const listener = vi.fn();
      const unsubscribe = workspace.onFoldersChanged(listener);

      const folder: WorkspaceFolder = {
        id: "folder-obs",
        name: "docs",
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      workspace.setFolder(folder);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      workspace.deleteFolder("folder-obs");
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("Independence from Transport and UI (CRDT Synchronization)", () => {
    it("synchronizes state and file content between workspace instances via CRDT updates", () => {
      const workspaceA = createWorkspace({
        id: "ws-sync",
        name: "Sync Test Workspace",
      });

      const docB = new Y.Doc();
      const workspaceB = createWorkspace(
        { id: "ws-sync", name: "Sync Test Workspace" },
        docB,
      );

      const created = workspaceA.createFile("index.ts", {
        initialContent: "console.log('init');",
      });
      const fileId = created.file!.id;

      workspaceA.updateFileContent(fileId, "console.log('updated content');");

      const updateFromA = Y.encodeStateAsUpdate(workspaceA.doc);
      Y.applyUpdate(workspaceB.doc, updateFromA);

      expect(workspaceB.hasFile(fileId)).toBe(true);
      expect(workspaceB.getFileContent(fileId)).toBe("console.log('updated content');");
      expect(workspaceB.getFile(fileId)?.name).toBe("index.ts");
    });
  });

  describe("Lifecycle", () => {
    it("destroys the underlying document without error", () => {
      const workspace = createWorkspace({ id: "ws-lifecycle", name: "Lifecycle WS" });
      expect(() => workspace.destroy()).not.toThrow();
    });
  });
});
