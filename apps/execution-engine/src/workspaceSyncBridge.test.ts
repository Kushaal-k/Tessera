import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as Y from "yjs";
import { WorkspaceSyncBridge, FS_ORIGIN } from "./workspaceSyncBridge.js";
import { WorkspaceStorage } from "./workspaceStorage.js";
import { FsWatcher } from "./fsWatcher.js";

describe("WorkspaceSyncBridge", () => {
    let tempBaseDir: string;
    let storage: WorkspaceStorage;
    let watcher: FsWatcher;
    let customDoc: Y.Doc;
    let bridge: WorkspaceSyncBridge;
    const workspaceId = "test-ws-bridge";

    // Mock socket to avoid real network requests in unit tests
    const createMockSocket = () => {
        return {
            connected: true,
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
            disconnect: vi.fn(),
        } as any;
    };

    beforeEach(async () => {
        tempBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "tessera-bridge-test-"));
        storage = new WorkspaceStorage({ baseDir: tempBaseDir });
        await storage.initWorkspace(workspaceId);

        const workspacePath = storage.getWorkspacePath(workspaceId);
        watcher = new FsWatcher(workspaceId, workspacePath, { debounceMs: 10 });
        customDoc = new Y.Doc();

        bridge = new WorkspaceSyncBridge({
            workspaceId,
            hostWorkspacePath: workspacePath,
            storage,
            watcher,
            customDoc,
            customSocket: createMockSocket(),
            debounceMs: 50,
        });
    });

    afterEach(async () => {
        await bridge.destroy();
        await watcher.stop();
        await fs.rm(tempBaseDir, { recursive: true, force: true });
    });

    describe("Inbound Synchronization (Disk -> Y.Doc)", () => {
        it("creates file and folder hierarchy in Y.Doc upon watcher add event", async () => {
            let receivedOrigin: unknown = null;
            customDoc.on("afterTransaction", (transaction) => {
                receivedOrigin = transaction.origin;
            });

            // Simulate watcher emitting an add event
            for (const listener of (watcher as any).listeners) {
                listener({
                    type: "add",
                    path: "src/components/Header.tsx",
                    workspaceId,
                    content: "export const Header = () => <header />;",
                });
            }

            // Yield to allow async event handling
            await new Promise((resolve) => setTimeout(resolve, 30));

            const files = bridge.workspace.getFiles();
            const folders = bridge.workspace.getFolders();

            expect(files.some((f) => f.name === "Header.tsx")).toBe(true);
            expect(folders.some((f) => f.name === "src")).toBe(true);
            expect(folders.some((f) => f.name === "components")).toBe(true);

            const file = files.find((f) => f.name === "Header.tsx");
            expect(bridge.workspace.getFileText(file!.id).toString()).toBe(
                "export const Header = () => <header />;",
            );
            expect(receivedOrigin).toBe(FS_ORIGIN);
        });

        it("updates file content in Y.Doc upon watcher change event", async () => {
            // First add the file
            for (const listener of (watcher as any).listeners) {
                listener({
                    type: "add",
                    path: "index.js",
                    workspaceId,
                    content: "console.log('v1');",
                });
            }
            await new Promise((resolve) => setTimeout(resolve, 30));

            // Then change the file
            for (const listener of (watcher as any).listeners) {
                listener({
                    type: "change",
                    path: "index.js",
                    workspaceId,
                    content: "console.log('v2');",
                });
            }
            await new Promise((resolve) => setTimeout(resolve, 30));

            const file = bridge.workspace.getFiles().find((f) => f.name === "index.js");
            expect(file).toBeDefined();
            expect(bridge.workspace.getFileText(file!.id).toString()).toBe("console.log('v2');");
        });

        it("deletes file from Y.Doc upon watcher unlink event", async () => {
            for (const listener of (watcher as any).listeners) {
                listener({
                    type: "add",
                    path: "temp.txt",
                    workspaceId,
                    content: "temporary",
                });
            }
            await new Promise((resolve) => setTimeout(resolve, 30));

            expect(bridge.workspace.getFiles().some((f) => f.name === "temp.txt")).toBe(true);

            for (const listener of (watcher as any).listeners) {
                listener({
                    type: "unlink",
                    path: "temp.txt",
                    workspaceId,
                });
            }
            await new Promise((resolve) => setTimeout(resolve, 30));

            expect(bridge.workspace.getFiles().some((f) => f.name === "temp.txt")).toBe(false);
        });
    });

    describe("Outbound Synchronization (Y.Doc -> Disk)", () => {
        it("writes newly created file in workspace to disk after debounce", async () => {
            const createRes = bridge.workspace.createFile("outbound.txt", {
                initialContent: "created from workspace",
            });
            expect(createRes.success).toBe(true);

            const diskFilePath = path.join(tempBaseDir, workspaceId, "outbound.txt");

            await vi.waitFor(async () => {
                const content = await fs.readFile(diskFilePath, "utf-8");
                expect(content).toBe("created from workspace");
            }, { timeout: 1500 });
        });

        it("writes modified text buffer to disk after debounce", async () => {
            const createRes = bridge.workspace.createFile("edit.txt", {
                initialContent: "line 1",
            });
            expect(createRes.success).toBe(true);

            const fileId = createRes.file!.id;
            const ytext = bridge.workspace.getFileText(fileId);

            // Simulate user typing in Monaco
            ytext.insert(6, "\nline 2");

            const diskFilePath = path.join(tempBaseDir, workspaceId, "edit.txt");

            await vi.waitFor(async () => {
                const content = await fs.readFile(diskFilePath, "utf-8");
                expect(content).toBe("line 1\nline 2");
            }, { timeout: 1500 });
        });

        it("removes file from disk when deleted in workspace", async () => {
            const createRes = bridge.workspace.createFile("to-delete.txt", {
                initialContent: "delete this",
            });
            expect(createRes.success).toBe(true);

            const diskFilePath = path.join(tempBaseDir, workspaceId, "to-delete.txt");

            await vi.waitFor(async () => {
                const exists = await fs.stat(diskFilePath).then(() => true).catch(() => false);
                expect(exists).toBe(true);
            }, { timeout: 1500 });

            bridge.workspace.deleteFile(createRes.file!.id);

            await vi.waitFor(async () => {
                const exists = await fs.stat(diskFilePath).then(() => true).catch(() => false);
                expect(exists).toBe(false);
            }, { timeout: 1500 });
        });
    });

    describe("Loop Prevention", () => {
        it("does not trigger outbound disk write when change originated from FS_ORIGIN", async () => {
            const writeSpy = vi.spyOn(storage, "writeFiles");

            // Apply event with FS_ORIGIN
            customDoc.transact(() => {
                bridge.workspace.createFile("internal.txt", {
                    initialContent: "from watcher",
                });
            }, FS_ORIGIN);

            await new Promise((resolve) => setTimeout(resolve, 150));

            // writeFiles should not have been called because origin was FS_ORIGIN
            expect(writeSpy).not.toHaveBeenCalled();
        });
    });
});
