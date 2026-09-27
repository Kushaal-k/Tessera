import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createWorkspace } from "@tessera/collaboration";

describe("Workspace Tree & Hook State Synchronization", () => {
  it("initializes empty workspace tree when ydoc has no files or folders", () => {
    const ydoc = new Y.Doc();
    const ws = createWorkspace({ id: "ws-1", name: "Test WS" }, ydoc);
    expect(ws.getFiles()).toEqual([]);
    expect(ws.getFolders()).toEqual([]);
    expect(ws.buildWorkspaceTree()).toEqual([]);
  });

  it("builds a hierarchical tree when files and folders are added to workspace", () => {
    const ydoc = new Y.Doc();
    const ws = createWorkspace({ id: "ws-1", name: "Test WS" }, ydoc);

    const folderRes = ws.createFolder("src");
    expect(folderRes.success).toBe(true);
    const srcFolderId = folderRes.folder!.id;

    const fileRes1 = ws.createFile("index.ts", {
      parentId: srcFolderId,
      initialContent: "console.log('hi');",
    });
    expect(fileRes1.success).toBe(true);

    const fileRes2 = ws.createFile("package.json", {
      initialContent: "{}",
    });
    expect(fileRes2.success).toBe(true);

    const tree = ws.buildWorkspaceTree();
    expect(tree).toHaveLength(2);

    // Folders come first deterministically
    const folderNode = tree.find((node) => node.type === "folder");
    const fileNode = tree.find((node) => node.type === "file");

    expect(folderNode).toBeDefined();
    expect(folderNode?.name).toBe("src");
    if (folderNode && folderNode.type === "folder") {
      expect(folderNode.children).toHaveLength(1);
      expect(folderNode.children[0]?.id).toBe(fileRes1.file!.id);
    }

    expect(fileNode).toBeDefined();
    expect(fileNode?.id).toBe(fileRes2.file!.id);
  });

  it("updates tree reactively when files and folders change in Y.Doc", () => {
    const ydoc = new Y.Doc();
    const ws = createWorkspace({ id: "ws-1", name: "Test WS" }, ydoc);

    let fileUpdates = 0;
    let folderUpdates = 0;

    const unsubFiles = ws.onFilesChanged(() => {
      fileUpdates += 1;
    });

    const unsubFolders = ws.onFoldersChanged(() => {
      folderUpdates += 1;
    });

    ws.createFolder("docs");
    expect(folderUpdates).toBe(1);

    ws.createFile("readme.md");
    expect(fileUpdates).toBe(1);

    unsubFiles();
    unsubFolders();

    ws.createFile("notes.txt");
    expect(fileUpdates).toBe(1);
  });

  it("provides isolated text buffers for different workspace files", () => {
    const ydoc = new Y.Doc();
    const ws = createWorkspace({ id: "ws-1", name: "Test WS" }, ydoc);

    const fileRes1 = ws.createFile("a.ts", { initialContent: "const a = 1;" });
    const fileRes2 = ws.createFile("b.ts", { initialContent: "const b = 2;" });

    expect(fileRes1.success).toBe(true);
    expect(fileRes2.success).toBe(true);

    const text1 = ws.getFileText(fileRes1.file!.id);
    const text2 = ws.getFileText(fileRes2.file!.id);

    expect(text1.toString()).toBe("const a = 1;");
    expect(text2.toString()).toBe("const b = 2;");

    text1.insert(text1.length, " // extra");
    expect(text1.toString()).toBe("const a = 1; // extra");
    expect(text2.toString()).toBe("const b = 2;");
  });

  it("auto-detects language when creating files with extensions", () => {
    const ydoc = new Y.Doc();
    const ws = createWorkspace({ id: "ws-1", name: "Test WS" }, ydoc);

    const tsFile = ws.createFile("index.ts");
    const pyFile = ws.createFile("script.py");
    const goFile = ws.createFile("main.go");
    const rsFile = ws.createFile("main.rs");
    const cppFile = ws.createFile("app.cpp");
    const unknownFile = ws.createFile("notes.unknown");

    expect(tsFile.file?.language).toBe("typescript");
    expect(pyFile.file?.language).toBe("python");
    expect(goFile.file?.language).toBe("go");
    expect(rsFile.file?.language).toBe("rust");
    expect(cppFile.file?.language).toBe("cpp");
    expect(unknownFile.file?.language).toBe("plaintext");
  });

  it("prevents creating duplicate sibling files or folders under the same parent", () => {
    const ydoc = new Y.Doc();
    const ws = createWorkspace({ id: "ws-1", name: "Test WS" }, ydoc);

    const file1 = ws.createFile("main.ts");
    expect(file1.success).toBe(true);

    const duplicateFile = ws.createFile("main.ts");
    expect(duplicateFile.success).toBe(false);
    expect(duplicateFile.error).toContain("Duplicate");

    const folder1 = ws.createFolder("components");
    expect(folder1.success).toBe(true);

    const duplicateFolder = ws.createFolder("components");
    expect(duplicateFolder.success).toBe(false);
    expect(duplicateFolder.error).toContain("Duplicate");

    // Creating inside the subfolder with same name as root is allowed
    const nestedFile = ws.createFile("main.ts", { parentId: folder1.folder!.id });
    expect(nestedFile.success).toBe(true);
  });

  it("renames files and folders, updating language on extension change and preventing duplicate names", () => {
    const ydoc = new Y.Doc();
    const ws = createWorkspace({ id: "ws-1", name: "Test WS" }, ydoc);

    const file1 = ws.createFile("app.ts");
    ws.createFile("index.py");
    const folder1 = ws.createFolder("src");
    ws.createFolder("docs");

    expect(file1.file?.language).toBe("typescript");

    // Renaming file extension updates language
    const renamedFile = ws.renameFile(file1.file!.id, "app.rs");
    expect(renamedFile.success).toBe(true);
    expect(renamedFile.file?.name).toBe("app.rs");
    expect(renamedFile.file?.language).toBe("rust");

    // Sibling duplicate file rename fails
    const duplicateRename = ws.renameFile(file1.file!.id, "index.py");
    expect(duplicateRename.success).toBe(false);

    // Folder rename works
    const renamedFolder = ws.renameFolder(folder1.folder!.id, "source");
    expect(renamedFolder.success).toBe(true);
    expect(renamedFolder.folder?.name).toBe("source");

    // Sibling duplicate folder rename fails
    const duplicateFolderRename = ws.renameFolder(folder1.folder!.id, "docs");
    expect(duplicateFolderRename.success).toBe(false);
  });

  it("deletes single files and recursively deletes folders with all nested descendants", () => {
    const ydoc = new Y.Doc();
    const ws = createWorkspace({ id: "ws-1", name: "Test WS" }, ydoc);

    const rootFile = ws.createFile("root.ts");
    const parentFolder = ws.createFolder("src");
    const subFolder = ws.createFolder("components", { parentId: parentFolder.folder!.id });
    const nestedFile = ws.createFile("Button.tsx", { parentId: subFolder.folder!.id });

    expect(ws.getFiles().length).toBe(2);
    expect(ws.getFolders().length).toBe(2);

    // Deleting single file removes it
    const deletedFileRes = ws.deleteFile(rootFile.file!.id);
    expect(deletedFileRes).toBe(true);
    expect(ws.getFiles().some((f) => f.id === rootFile.file!.id)).toBe(false);

    // Deleting parent folder cascades to subfolder and nested files
    const deletedFolderRes = ws.deleteFolder(parentFolder.folder!.id);
    expect(deletedFolderRes).toBe(true);
    expect(ws.getFolders().length).toBe(0);
    expect(ws.getFiles().some((f) => f.id === nestedFile.file!.id)).toBe(false);
  });
});
