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
});
