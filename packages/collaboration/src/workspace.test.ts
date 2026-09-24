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

  describe("Folder Management (Issue #514)", () => {
    it("creates a folder at workspace root with default parentId null", () => {
      const workspace = createWorkspace({ id: "ws-folder-root", name: "Root WS" });

      const result = workspace.createFolder("src");

      expect(result.success).toBe(true);
      expect(result.folder).toBeDefined();
      expect(result.folder?.name).toBe("src");
      expect(result.folder?.parentId).toBeNull();
      expect(result.folder?.id).toBeDefined();
      expect(result.folder?.createdAt).toBeDefined();
      expect(result.folder?.updatedAt).toBeDefined();

      expect(workspace.hasFolder(result.folder!.id)).toBe(true);
      expect(workspace.getFolder(result.folder!.id)?.name).toBe("src");
    });

    it("rejects empty folder names", () => {
      const workspace = createWorkspace({ id: "ws-empty-folder", name: "Empty Folder WS" });

      const result = workspace.createFolder("   ");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Folder name cannot be empty");
      expect(workspace.getFolders()).toHaveLength(0);
    });

    it("creates nested folders and computes paths", () => {
      const workspace = createWorkspace({ id: "ws-nested", name: "Nested WS" });

      const root = workspace.createFolder("src").folder!;
      const nested = workspace.createFolder("components", { parentId: root.id }).folder!;
      const deep = workspace.createFolder("ui", { parentId: nested.id }).folder!;

      expect(nested.parentId).toBe(root.id);
      expect(deep.parentId).toBe(nested.id);

      expect(workspace.getFolderPath(root.id)).toBe("/src");
      expect(workspace.getFolderPath(nested.id)).toBe("/src/components");
      expect(workspace.getFolderPath(deep.id)).toBe("/src/components/ui");

      const rootChildren = workspace.getSubfolders(root.id);
      expect(rootChildren).toHaveLength(1);
      expect(rootChildren[0]!.id).toBe(nested.id);
    });

    it("rejects creating a folder under a non-existent parent folder", () => {
      const workspace = createWorkspace({ id: "ws-invalid-parent", name: "Invalid Parent WS" });

      const result = workspace.createFolder("orphan", { parentId: "non-existent-id" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Parent folder does not exist");
      expect(workspace.getFolders()).toHaveLength(0);
    });

    it("prevents duplicate folder names within the same parent folder", () => {
      const workspace = createWorkspace({ id: "ws-dup-folders", name: "Dup Folder WS" });

      const first = workspace.createFolder("docs");
      expect(first.success).toBe(true);

      const duplicate = workspace.createFolder("docs");
      expect(duplicate.success).toBe(false);
      expect(duplicate.error).toBe("Duplicate folder in parent directory");
      expect(workspace.getFolders()).toHaveLength(1);
    });

    it("allows same folder name in different parent folders", () => {
      const workspace = createWorkspace({ id: "ws-diff-parent", name: "Diff Parent WS" });

      const src = workspace.createFolder("src").folder!;
      const tests = workspace.createFolder("tests").folder!;

      const srcUtils = workspace.createFolder("utils", { parentId: src.id });
      const testUtils = workspace.createFolder("utils", { parentId: tests.id });

      expect(srcUtils.success).toBe(true);
      expect(testUtils.success).toBe(true);
      expect(workspace.getFolderPath(srcUtils.folder!.id)).toBe("/src/utils");
      expect(workspace.getFolderPath(testUtils.folder!.id)).toBe("/tests/utils");
    });

    it("deletes a folder recursively, cascading to nested subfolders and contained files", () => {
      const workspace = createWorkspace({ id: "ws-cascade", name: "Cascade WS" });

      const src = workspace.createFolder("src").folder!;
      const components = workspace.createFolder("components", { parentId: src.id }).folder!;
      const fileInSubfolder = workspace.createFile("Button.tsx", {
        parentId: components.id,
        initialContent: "export const Button = () => null;",
      }).file!;
      const fileInRoot = workspace.createFile("index.ts", {
        parentId: src.id,
        initialContent: "export * from './components';",
      }).file!;

      expect(workspace.hasFolder(src.id)).toBe(true);
      expect(workspace.hasFolder(components.id)).toBe(true);
      expect(workspace.hasFile(fileInSubfolder.id)).toBe(true);
      expect(workspace.hasFile(fileInRoot.id)).toBe(true);

      const deleted = workspace.deleteFolder(src.id);
      expect(deleted).toBe(true);

      expect(workspace.hasFolder(src.id)).toBe(false);
      expect(workspace.hasFolder(components.id)).toBe(false);
      expect(workspace.hasFile(fileInSubfolder.id)).toBe(false);
      expect(workspace.hasFile(fileInRoot.id)).toBe(false);
      expect(workspace.getFileText(fileInSubfolder.id).toString()).toBe("");
      expect(workspace.getFileText(fileInRoot.id).toString()).toBe("");
      expect(workspace.deleteFolder(src.id)).toBe(false);
    });

    it("renames a folder and validates naming constraints", () => {
      const workspace = createWorkspace({ id: "ws-rename-folder", name: "Rename Folder WS" });

      const folder = workspace.createFolder("old-name").folder!;
      workspace.createFolder("existing");

      const emptyRename = workspace.renameFolder(folder.id, "   ");
      expect(emptyRename.success).toBe(false);
      expect(emptyRename.error).toBe("Folder name cannot be empty");

      const dupRename = workspace.renameFolder(folder.id, "existing");
      expect(dupRename.success).toBe(false);
      expect(dupRename.error).toBe("Duplicate folder in parent directory");

      const sameNameRename = workspace.renameFolder(folder.id, "old-name");
      expect(sameNameRename.success).toBe(true);

      const validRename = workspace.renameFolder(folder.id, "new-name");
      expect(validRename.success).toBe(true);
      expect(validRename.folder?.name).toBe("new-name");
      expect(workspace.getFolder(folder.id)?.name).toBe("new-name");
    });

    it("moves a folder to another parent folder", () => {
      const workspace = createWorkspace({ id: "ws-move-folder", name: "Move Folder WS" });

      const folderA = workspace.createFolder("folderA").folder!;
      const folderB = workspace.createFolder("folderB").folder!;

      const moveResult = workspace.moveFolder(folderB.id, folderA.id);
      expect(moveResult.success).toBe(true);
      expect(moveResult.folder?.parentId).toBe(folderA.id);
      expect(workspace.getFolderPath(folderB.id)).toBe("/folderA/folderB");
    });

    it("prevents moving a folder into itself", () => {
      const workspace = createWorkspace({ id: "ws-move-self", name: "Move Self WS" });

      const folder = workspace.createFolder("self").folder!;
      const result = workspace.moveFolder(folder.id, folder.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot move folder into itself");
    });

    it("prevents moving a folder into its own descendant (cycle prevention)", () => {
      const workspace = createWorkspace({ id: "ws-cycle", name: "Cycle WS" });

      const a = workspace.createFolder("a").folder!;
      const b = workspace.createFolder("b", { parentId: a.id }).folder!;
      const c = workspace.createFolder("c", { parentId: b.id }).folder!;

      const cycleResult = workspace.moveFolder(a.id, c.id);
      expect(cycleResult.success).toBe(false);
      expect(cycleResult.error).toBe("Cannot move folder into its own descendant");

      expect(workspace.getFolder(a.id)?.parentId).toBeNull();
      expect(workspace.getFolder(b.id)?.parentId).toBe(a.id);
      expect(workspace.getFolder(c.id)?.parentId).toBe(b.id);
    });

    it("prevents moving a folder to a non-existent parent folder", () => {
      const workspace = createWorkspace({ id: "ws-move-nonexistent", name: "Move Nonexistent WS" });

      const folder = workspace.createFolder("source").folder!;
      const result = workspace.moveFolder(folder.id, "missing-folder-id");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Target folder does not exist");
    });

    it("prevents destination name collisions when moving folders", () => {
      const workspace = createWorkspace({ id: "ws-move-collision", name: "Move Collision WS" });

      const target = workspace.createFolder("target").folder!;
      workspace.createFolder("shared", { parentId: target.id });

      const source = workspace.createFolder("shared").folder!;
      const result = workspace.moveFolder(source.id, target.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists in target folder");
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
