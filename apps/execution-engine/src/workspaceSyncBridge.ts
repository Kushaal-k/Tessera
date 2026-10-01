import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import {
    createWorkspace,
    TesseraSocketProvider,
    type Workspace,
} from "@tessera/collaboration";
import type {
    FsWatchEvent,
    Participant,
    SyncClientToServerEvents,
    SyncServerToClientEvents,
} from "@tessera/shared-types";
import type { FsWatcher } from "./fsWatcher.js";
import type { WorkspaceStorage } from "./workspaceStorage.js";
import {
    ensureFolderHierarchy,
    findFileByPath,
    findFolderByPath,
    getRelativeFilePath,
} from "./workspaceSyncUtils.js";

export const FS_ORIGIN = "fs-watcher-origin";

export interface WorkspaceSyncBridgeOptions {
    readonly workspaceId: string;
    readonly hostWorkspacePath: string;
    readonly storage: WorkspaceStorage;
    readonly watcher: FsWatcher;
    readonly syncServerUrl?: string;
    readonly debounceMs?: number;
    readonly customSocket?: Socket<SyncServerToClientEvents, SyncClientToServerEvents>;
    readonly customDoc?: Y.Doc;
}

export class WorkspaceSyncBridge {
    public readonly workspaceId: string;
    public readonly hostWorkspacePath: string;
    private readonly storage: WorkspaceStorage;
    private readonly watcher: FsWatcher;
    private readonly debounceMs: number;

    private readonly socket: Socket<SyncServerToClientEvents, SyncClientToServerEvents>;
    private readonly doc: Y.Doc;
    private readonly awareness: Awareness;
    private readonly provider: TesseraSocketProvider;
    public readonly workspace: Workspace;

    private readonly unsubscribeWatcher: () => void;
    private readonly unsubscribeFiles: () => void;
    private readonly unsubscribeFolders: () => void;
    private readonly textObservers = new Map<string, () => void>();
    private readonly trackedFiles = new Map<string, string>();
    private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
    private currentTransactionOrigin: unknown = null;
    private destroyed = false;
    private isReconciling = false;
    public reconciliationPromise: Promise<void> | null = null;

    constructor(options: WorkspaceSyncBridgeOptions) {
        this.workspaceId = options.workspaceId;
        this.hostWorkspacePath = options.hostWorkspacePath;
        this.storage = options.storage;
        this.watcher = options.watcher;
        this.debounceMs = options.debounceMs ?? 300;

        const serverUrl =
            options.syncServerUrl ??
            process.env["SYNC_SERVER_URL"] ??
            "http://localhost:4000";

        this.doc = options.customDoc ?? new Y.Doc();
        this.awareness = new Awareness(this.doc);

        this.socket =
            options.customSocket ??
            (io(serverUrl, {
                transports: ["websocket"],
                reconnection: true,
            }) as Socket<SyncServerToClientEvents, SyncClientToServerEvents>);

        this.provider = new TesseraSocketProvider({
            socket: this.socket,
            ydoc: this.doc,
            awareness: this.awareness,
        });

        this.workspace = createWorkspace(
            { id: this.workspaceId, name: "Workspace" },
            this.doc,
        );

        // Join the sync room on the sync-server
        const participant: Participant = {
            id: `engine-${this.workspaceId}`,
            displayName: "Filesystem Engine",
            cursorColor: "#64748b",
            isAI: false,
        };

        if (this.socket.connected) {
            this.socket.emit("join-room", {
                roomId: this.workspaceId,
                participant,
            });
            this.reconciliationPromise = this.reconcileInitialState();
        } else {
            this.socket.on("connect", () => {
                this.socket.emit("join-room", {
                    roomId: this.workspaceId,
                    participant,
                });
                this.reconciliationPromise = this.reconcileInitialState();
            });
        }

        // Bind inbound watcher events (Disk -> Y.Doc)
        this.unsubscribeWatcher = this.watcher.onEvent((event) => {
            void this.handleFsEvent(event);
        });

        // Initialize tracked files and text observers for outbound sync (Y.Doc -> Disk)
        for (const file of this.workspace.getFiles()) {
            const relPath = getRelativeFilePath(file, this.workspace.getFolders());
            this.trackedFiles.set(file.id, relPath);
            this.attachTextObserver(file.id);
        }

        this.unsubscribeFiles = this.workspace.onFilesChanged(() => {
            this.handleFilesChanged();
        });

        this.unsubscribeFolders = this.workspace.onFoldersChanged(() => {
            this.handleFoldersChanged();
        });

        this.doc.on("beforeTransaction", (tr: Y.Transaction) => {
            this.currentTransactionOrigin = tr.origin;
        });

        this.doc.on("afterTransaction", () => {
            this.currentTransactionOrigin = null;
        });
    }

    private async handleFsEvent(event: FsWatchEvent): Promise<void> {
        if (this.destroyed) {
            return;
        }

        const cleanPath = event.path.replace(/^\/+/, "").trim();
        if (!cleanPath) {
            return;
        }

        switch (event.type) {
            case "addDir": {
                this.doc.transact(() => {
                    ensureFolderHierarchy(cleanPath, this.workspace);
                }, FS_ORIGIN);
                break;
            }

            case "unlinkDir": {
                const folder = findFolderByPath(cleanPath, this.workspace.getFolders());
                if (folder) {
                    this.doc.transact(() => {
                        this.workspace.deleteFolder(folder.id);
                    }, FS_ORIGIN);
                }
                break;
            }

            case "add":
            case "change": {
                const parts = cleanPath.split("/").filter(Boolean);
                const fileName = parts.pop();
                if (!fileName) {
                    return;
                }

                const parentPath = parts.join("/");
                const existingFile = findFileByPath(
                    cleanPath,
                    this.workspace.getFiles(),
                    this.workspace.getFolders(),
                );

                this.doc.transact(() => {
                    const parentId = parentPath
                        ? ensureFolderHierarchy(parentPath, this.workspace)
                        : null;

                    if (existingFile) {
                        if (typeof event.content === "string") {
                            this.workspace.updateFileContent(existingFile.id, event.content);
                        }
                    } else {
                        const createRes = this.workspace.createFile(fileName, {
                            parentId,
                            initialContent: event.content ?? "",
                        });
                        if (createRes.success && createRes.file) {
                            this.trackedFiles.set(createRes.file.id, cleanPath);
                            this.attachTextObserver(createRes.file.id);
                        }
                    }
                }, FS_ORIGIN);
                break;
            }

            case "unlink": {
                const file = findFileByPath(
                    cleanPath,
                    this.workspace.getFiles(),
                    this.workspace.getFolders(),
                );
                if (file) {
                    this.doc.transact(() => {
                        this.workspace.deleteFile(file.id);
                    }, FS_ORIGIN);
                }
                break;
            }
        }
    }

    public async reconcileInitialState(): Promise<void> {
        if (this.destroyed) {
            return;
        }

        if (this.isReconciling) {
            return;
        }

        this.isReconciling = true;
        try {
            const diskFiles = await this.storage.listFiles(this.workspaceId);
            const diskFileSet = new Set(diskFiles);
            const crdtFiles = this.workspace.getFiles();
            const folders = this.workspace.getFolders();
            const crdtFileMap = new Map<string, typeof crdtFiles[0]>();

            for (const file of crdtFiles) {
                const relPath = getRelativeFilePath(file, folders);
                crdtFileMap.set(relPath, file);
            }

            // Case 1: File in CRDT but not on disk -> populate disk
            for (const [relPath, file] of crdtFileMap.entries()) {
                if (!diskFileSet.has(relPath)) {
                    const content = this.workspace.getFileContent(file.id) ?? "";
                    this.watcher.markRecentWrite(relPath, content);
                    await this.storage.writeFiles(this.workspaceId, [
                        { path: relPath, content },
                    ]);
                    this.trackedFiles.set(file.id, relPath);
                    this.attachTextObserver(file.id);
                }
            }

            // Case 2: File on disk but not in CRDT -> import into CRDT
            for (const diskRelPath of diskFiles) {
                if (!crdtFileMap.has(diskRelPath)) {
                    try {
                        const content = await this.storage.readFile(this.workspaceId, diskRelPath);
                        const parts = diskRelPath.split("/").filter(Boolean);
                        const fileName = parts.pop();
                        if (!fileName) {
                            continue;
                        }
                        const parentPath = parts.join("/");

                        this.doc.transact(() => {
                            const parentId = parentPath
                                ? ensureFolderHierarchy(parentPath, this.workspace)
                                : null;
                            const res = this.workspace.createFile(fileName, {
                                parentId,
                                initialContent: content,
                            });
                            if (res.success && res.file) {
                                this.trackedFiles.set(res.file.id, diskRelPath);
                                this.attachTextObserver(res.file.id);
                            }
                        }, FS_ORIGIN);
                    } catch {
                        // Ignore unreadable or binary file
                    }
                }
            }

            // Case 3: File exists on both -> reconcile content
            for (const [relPath, file] of crdtFileMap.entries()) {
                if (diskFileSet.has(relPath)) {
                    try {
                        const diskContent = await this.storage.readFile(this.workspaceId, relPath);
                        const crdtContent = this.workspace.getFileContent(file.id) ?? "";
                        if (diskContent !== crdtContent) {
                            this.doc.transact(() => {
                                this.workspace.updateFileContent(file.id, diskContent);
                            }, FS_ORIGIN);
                        }
                        this.trackedFiles.set(file.id, relPath);
                        this.attachTextObserver(file.id);
                    } catch {
                        // Ignore
                    }
                }
            }
        } catch (err: unknown) {
            console.error(`Reconciliation failed for workspace ${this.workspaceId}:`, err);
        } finally {
            this.isReconciling = false;
        }
    }

    private scheduleDebouncedDiskWrite(fileId: string): void {
        const existingTimer = this.debounceTimers.get(fileId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
            this.debounceTimers.delete(fileId);
            if (this.destroyed) {
                return;
            }

            const file = this.workspace.getFile(fileId);
            if (!file) {
                return;
            }

            const folders = this.workspace.getFolders();
            const relPath = getRelativeFilePath(file, folders);
            const content = this.workspace.getFileContent(fileId) ?? "";

            this.watcher.markRecentWrite(relPath, content);
            try {
                await this.storage.writeFiles(this.workspaceId, [
                    { path: relPath, content },
                ]);
            } catch (err: unknown) {
                console.error(`Failed to sync file ${relPath} to disk:`, err);
            }
        }, this.debounceMs);

        this.debounceTimers.set(fileId, timer);
    }

    private attachTextObserver(fileId: string): void {
        if (this.textObservers.has(fileId)) {
            return;
        }

        const ytext = this.workspace.getFileText(fileId);
        const observer = (_event: Y.YTextEvent, transaction: Y.Transaction) => {
            if (transaction.origin === FS_ORIGIN) {
                return;
            }
            if (!this.workspace.hasFile(fileId)) {
                return;
            }
            this.scheduleDebouncedDiskWrite(fileId);
        };

        ytext.observe(observer);
        this.textObservers.set(fileId, () => {
            ytext.unobserve(observer);
        });
    }

    private handleFilesChanged(): void {
        const isFromWatcher = this.currentTransactionOrigin === FS_ORIGIN;
        const files = this.workspace.getFiles();
        const folders = this.workspace.getFolders();
        const currentFileIds = new Set<string>();

        for (const file of files) {
            currentFileIds.add(file.id);
            const newPath = getRelativeFilePath(file, folders);
            const oldPath = this.trackedFiles.get(file.id);

            if (!oldPath) {
                // New file created in workspace
                this.trackedFiles.set(file.id, newPath);
                this.attachTextObserver(file.id);
                if (!isFromWatcher) {
                    this.scheduleDebouncedDiskWrite(file.id);
                }
            } else if (oldPath !== newPath) {
                // Renamed or moved file
                this.trackedFiles.set(file.id, newPath);
                if (!isFromWatcher) {
                    this.watcher.markRecentWrite(oldPath);
                    void this.storage.deletePath(this.workspaceId, oldPath).catch(() => {});
                    this.scheduleDebouncedDiskWrite(file.id);
                }
            } else {
                this.attachTextObserver(file.id);
            }
        }

        // Deleted files
        for (const [fileId, oldPath] of Array.from(this.trackedFiles.entries())) {
            if (!currentFileIds.has(fileId)) {
                this.trackedFiles.delete(fileId);
                const unobserve = this.textObservers.get(fileId);
                if (unobserve) {
                    unobserve();
                    this.textObservers.delete(fileId);
                }

                const timer = this.debounceTimers.get(fileId);
                if (timer) {
                    clearTimeout(timer);
                    this.debounceTimers.delete(fileId);
                }

                if (!isFromWatcher) {
                    this.watcher.markRecentWrite(oldPath);
                    void this.storage.deletePath(this.workspaceId, oldPath).catch(() => {});
                }
            }
        }
    }

    private handleFoldersChanged(): void {
        if (this.currentTransactionOrigin === FS_ORIGIN) {
            return;
        }

        const files = this.workspace.getFiles();
        const folders = this.workspace.getFolders();

        for (const file of files) {
            const newPath = getRelativeFilePath(file, folders);
            const oldPath = this.trackedFiles.get(file.id);

            if (oldPath && oldPath !== newPath) {
                this.trackedFiles.set(file.id, newPath);
                this.watcher.markRecentWrite(oldPath);
                void this.storage.deletePath(this.workspaceId, oldPath).catch(() => {});
                this.scheduleDebouncedDiskWrite(file.id);
            }
        }
    }

    public async destroy(): Promise<void> {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;

        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        for (const unobserve of this.textObservers.values()) {
            unobserve();
        }
        this.textObservers.clear();
        this.trackedFiles.clear();

        this.unsubscribeWatcher();
        this.unsubscribeFiles();
        this.unsubscribeFolders();

        this.provider.destroy();
        this.socket.disconnect();
    }
}
