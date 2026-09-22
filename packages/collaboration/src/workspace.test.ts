import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { Workspace, createWorkspace, WORKSPACE_KEYS } from "./workspace.js";
import type { WorkspaceFile, WorkspaceFolder } from "@tessera/shared-types";

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

  describe("File Storage", () => {
    it("stores, retrieves, checks, and lists files", () => {
      const workspace = createWorkspace({ id: "ws-files", name: "Files WS" });

      const file1: WorkspaceFile = {
        id: "file-1",
        name: "index.ts",
        parentId: null,
        language: "typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const file2: WorkspaceFile = {
        id: "file-2",
        name: "styles.css",
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      workspace.setFile(file1);
      workspace.setFile(file2);

      expect(workspace.hasFile("file-1")).toBe(true);
      expect(workspace.hasFile("file-2")).toBe(true);
      expect(workspace.hasFile("file-nonexistent")).toBe(false);

      expect(workspace.getFile("file-1")).toEqual(file1);
      expect(workspace.getFile("file-2")).toEqual(file2);
      expect(workspace.getFile("file-nonexistent")).toBeUndefined();

      const allFiles = workspace.getFiles();
      expect(allFiles).toHaveLength(2);
      expect(allFiles).toEqual(expect.arrayContaining([file1, file2]));
    });

    it("deletes files from the workspace", () => {
      const workspace = createWorkspace({ id: "ws-files", name: "Files WS" });

      const file: WorkspaceFile = {
        id: "file-del",
        name: "delete-me.ts",
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      workspace.setFile(file);
      expect(workspace.hasFile("file-del")).toBe(true);

      const deleted = workspace.deleteFile("file-del");
      expect(deleted).toBe(true);
      expect(workspace.hasFile("file-del")).toBe(false);
      expect(workspace.getFile("file-del")).toBeUndefined();

      const deleteAgain = workspace.deleteFile("file-del");
      expect(deleteAgain).toBe(false);
    });

    it("provides collaborative Y.Text for file contents", () => {
      const workspace = createWorkspace({ id: "ws-text", name: "Text WS" });

      const text = workspace.getFileText("file-1");
      expect(text).toBeInstanceOf(Y.Text);

      text.insert(0, "console.log('hello world');");
      expect(text.toString()).toBe("console.log('hello world');");

      const sameText = workspace.getFileText("file-1");
      expect(sameText.toString()).toBe("console.log('hello world');");
    });

    it("notifies listeners on file changes", () => {
      const workspace = createWorkspace({ id: "ws-files-obs", name: "Obs WS" });

      const listener = vi.fn();
      const unsubscribe = workspace.onFilesChanged(listener);

      const file: WorkspaceFile = {
        id: "file-obs",
        name: "main.py",
        parentId: null,
        language: "python",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      workspace.setFile(file);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      workspace.deleteFile("file-obs");
      expect(listener).toHaveBeenCalledTimes(1);
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

      const deleteAgain = workspace.deleteFolder("folder-del");
      expect(deleteAgain).toBe(false);
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

  describe("Independence from Transport and UI", () => {
    it("synchronizes state between workspace instances via CRDT updates", () => {
      const workspaceA = createWorkspace({
        id: "ws-sync",
        name: "Sync Test Workspace",
      });

      const docB = new Y.Doc();
      const workspaceB = createWorkspace(
        { id: "ws-sync", name: "Sync Test Workspace" },
        docB,
      );

      const file: WorkspaceFile = {
        id: "synced-file",
        name: "app.ts",
        parentId: null,
        language: "typescript",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      workspaceA.setFile(file);

      const folder: WorkspaceFolder = {
        id: "synced-folder",
        name: "lib",
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      workspaceA.setFolder(folder);

      const textA = workspaceA.getFileText("synced-file");
      textA.insert(0, "export const x = 42;");

      workspaceA.updateMetadata({ description: "Updated description" });

      const updateFromA = Y.encodeStateAsUpdate(workspaceA.doc);
      Y.applyUpdate(workspaceB.doc, updateFromA);

      expect(workspaceB.getFile("synced-file")).toEqual(file);
      expect(workspaceB.getFolder("synced-folder")).toEqual(folder);
      expect(workspaceB.getFileText("synced-file").toString()).toBe(
        "export const x = 42;",
      );
      expect(workspaceB.getMetadata().description).toBe("Updated description");
    });
  });

  describe("Lifecycle", () => {
    it("destroys the underlying document without error", () => {
      const workspace = createWorkspace({ id: "ws-lifecycle", name: "Lifecycle WS" });
      expect(() => workspace.destroy()).not.toThrow();
    });
  });
});

