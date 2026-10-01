import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as Y from "yjs";
import { createWorkspace } from "@tessera/collaboration";
import { WorkspaceSyncBridge, FS_ORIGIN } from "./workspaceSyncBridge.js";
import { WorkspaceStorage } from "./workspaceStorage.js";
import { FsWatcher } from "./fsWatcher.js";
import { getRelativeFolderPath } from "./workspaceSyncUtils.js";

describe("WorkspaceSyncBridge", () => {
    let tempBaseDir: string;
    let storage: WorkspaceStorage;
    let watcher: FsWatcher;
    let customDoc: Y.Doc;
    let bridge: WorkspaceSyncBridge;
    const workspaceId = "test-ws-bridge";

    // Mock socket to avoid real network requests in unit tests
    const createMockSocket = () => {
        const listeners = new Map<string, Set<(...args: any[]) => void>>();
        const socket = {
            connected: true,
            emit: vi.fn((event: string) => {
                if (event === "sync-step-1") {
                    queueMicrotask(() => {
                        for (const listener of listeners.get("sync-step-2") ?? []) {
                            listener(Y.encodeStateAsUpdate(customDoc));
                        }
                    });
                }
            }),
            on: vi.fn((event: string, listener: (...args: any[]) => void) => {
                const callbacks = listeners.get(event) ?? new Set();
                callbacks.add(listener);
                listeners.set(event, callbacks);
            }),
            off: vi.fn((event: string, listener: (...args: any[]) => void) => {
                listeners.get(event)?.delete(listener);
            }),
            disconnect: vi.fn(),
            receive: (event: string, ...args: any[]) => {
                for (const listener of listeners.get(event) ?? []) {
                    listener(...args);
                }
            },
        };
        return socket as any;
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

        await vi.waitFor(() => expect(bridge.reconciliationPromise).not.toBeNull());
        await bridge.reconciliationPromise;
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

    describe("Folder synchronization", () => {
        const folderPaths = () => bridge.workspace.getFolders().map((folder) =>
            getRelativeFolderPath(folder, bridge.workspace.getFolders()),
        );

        it("imports existing nested empty directories without importing dependencies", async () => {
            await storage.createFolder(workspaceId, "hello/empty/deep");
            await storage.createFolder(workspaceId, "node_modules/dependency");
            await bridge.reconcileInitialState();
            expect(folderPaths().sort()).toEqual(["hello", "hello/empty", "hello/empty/deep"]);
            expect(bridge.workspace.getFiles()).toHaveLength(0);
        });

        it("projects document folders at startup even when they contain no files", async () => {
            customDoc.transact(() => {
                const parent = bridge.workspace.createFolder("seeded").folder!;
                bridge.workspace.createFolder("empty", { parentId: parent.id });
            }, FS_ORIGIN);
            await bridge.reconcileInitialState();
            expect((await storage.listEntries(workspaceId)).folders.sort()).toEqual(["seeded", "seeded/empty"]);
        });

        it("creates and removes an empty folder changed in the editor", async () => {
            const folder = bridge.workspace.createFolder("editor-empty").folder!;
            await vi.waitFor(async () => {
                expect((await storage.listEntries(workspaceId)).folders).toContain("editor-empty");
            });
            bridge.workspace.deleteFolder(folder.id);
            await vi.waitFor(async () => {
                expect((await storage.listEntries(workspaceId)).folders).not.toContain("editor-empty");
            });
        });

        it("renames and moves nested folders while preserving source and runtime-only files", async () => {
            watcher.start();
            await watcher.waitUntilReady();
            const parent = bridge.workspace.createFolder("project").folder!;
            const nested = bridge.workspace.createFolder("nested", { parentId: parent.id }).folder!;
            bridge.workspace.createFolder("empty", { parentId: nested.id });
            const file = bridge.workspace.createFile("index.js", { parentId: nested.id, initialContent: "source" }).file!;
            await vi.waitFor(async () => {
                expect(await storage.readFile(workspaceId, "project/nested/index.js")).toBe("source");
            });
            await storage.writeFiles(workspaceId, [{ path: "project/node_modules/dependency.js", content: "runtime only" }]);
            bridge.workspace.renameFolder(parent.id, "renamed");
            bridge.workspace.getFileText(file.id).insert(6, " editor change");
            await vi.waitFor(async () => {
                expect(await storage.readFile(workspaceId, "renamed/nested/index.js")).toBe("source editor change");
                expect(await storage.readFile(workspaceId, "renamed/node_modules/dependency.js")).toBe("runtime only");
                expect((await storage.listEntries(workspaceId)).folders).toContain("renamed/nested/empty");
            });
            const destination = bridge.workspace.createFolder("destination").folder!;
            bridge.workspace.moveFolder(parent.id, destination.id);
            await vi.waitFor(async () => {
                expect(await storage.readFile(workspaceId, "destination/renamed/nested/index.js")).toBe("source editor change");
                expect(await storage.readFile(workspaceId, "destination/renamed/node_modules/dependency.js")).toBe("runtime only");
            });
            bridge.workspace.deleteFolder(destination.id);
            await vi.waitFor(async () => {
                expect((await storage.listEntries(workspaceId)).folders).toEqual([]);
                expect((await storage.listEntries(workspaceId)).files).toEqual([]);
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(folderPaths()).toEqual([]);
        });

        it("observes terminal folder creation, rename, and deletion", async () => {
            watcher.start();
            await watcher.waitUntilReady();
            await storage.createFolder(workspaceId, "terminal-empty/nested");
            await vi.waitFor(() => expect(folderPaths()).toContain("terminal-empty/nested"));
            await storage.renamePath(workspaceId, "terminal-empty", "terminal-renamed");
            await vi.waitFor(() => {
                expect(folderPaths()).toContain("terminal-renamed/nested");
                expect(folderPaths()).not.toContain("terminal-empty");
            });
            await storage.deletePath(workspaceId, "terminal-renamed");
            await vi.waitFor(() => expect(folderPaths()).toEqual([]));
        });
    });

    describe("Loop Prevention", () => {
        it("ignores an unchanged disk echo while a newer editor write is pending", async () => {
            const file = bridge.workspace.createFile("echo.js", { initialContent: "seed" }).file!;
            await vi.waitFor(async () => {
                expect(await storage.readFile(workspaceId, "echo.js")).toBe("seed");
            });
            bridge.workspace.getFileText(file.id).insert(4, " editor change");
            for (const listener of (watcher as any).listeners) {
                listener({ type: "change", path: "echo.js", workspaceId, content: "seed" });
            }
            expect(bridge.workspace.getFileContent(file.id)).toBe("seed editor change");
            await vi.waitFor(async () => {
                expect(await storage.readFile(workspaceId, "echo.js")).toBe("seed editor change");
            });
        });

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

    describe("Initial & Reconnect Reconciliation", () => {
        it("waits for the room document before importing existing disk files", async () => {
            await bridge.destroy();
            customDoc = new Y.Doc();
            const roomDoc = new Y.Doc();
            const roomWorkspace = createWorkspace({ id: workspaceId, name: "Room" }, roomDoc);
            const seeded = roomWorkspace.createFile("existing.js", { initialContent: "room content" }).file!;
            await storage.writeFiles(workspaceId, [{ path: "existing.js", content: "disk content" }]);
            const socket = createMockSocket();
            socket.emit.mockImplementation(() => {});
            bridge = new WorkspaceSyncBridge({
                workspaceId,
                hostWorkspacePath: storage.getWorkspacePath(workspaceId),
                storage,
                watcher,
                customDoc,
                customSocket: socket,
                debounceMs: 10,
            });
            try {
                expect(bridge.reconciliationPromise).toBeNull();
                expect(bridge.workspace.getFiles()).toHaveLength(0);
                socket.receive("sync-step-2", Y.encodeStateAsUpdate(roomDoc));
                await bridge.reconciliationPromise;
                expect(bridge.workspace.getFiles()).toHaveLength(1);
                expect(bridge.workspace.getFileContent(seeded.id)).toBe("disk content");
                expect(await storage.readFile(workspaceId, "existing.js")).toBe("disk content");
            } finally {
                roomDoc.destroy();
            }
        });

        it("populates disk when Y.Doc already contains files", async () => {
            bridge.workspace.createFile("seed.json", {
                initialContent: '{"seeded": true}',
            });

            await bridge.reconcileInitialState();

            const diskPath = path.join(tempBaseDir, workspaceId, "seed.json");
            const content = await fs.readFile(diskPath, "utf-8");
            expect(content).toBe('{"seeded": true}');
        });

        it("imports pre-existing disk files into Y.Doc on initial start", async () => {
            const diskPath = path.join(tempBaseDir, workspaceId, "existing.ts");
            await fs.writeFile(diskPath, "export const x = 42;", "utf-8");

            await bridge.reconcileInitialState();

            const file = bridge.workspace.getFiles().find((f) => f.name === "existing.ts");
            expect(file).toBeDefined();
            expect(bridge.workspace.getFileContent(file!.id)).toBe("export const x = 42;");
        });
    });
});
