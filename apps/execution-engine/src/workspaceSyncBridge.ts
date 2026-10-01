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
    getRelativeFolderPath,
} from "./workspaceSyncUtils.js";

export const FS_ORIGIN = "fs-watcher-origin";

export interface WorkspaceSyncBridgeOptions {
    readonly workspaceId: string;
    readonly roomId?: string;
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
    private readonly roomId: string;
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
    private readonly trackedFolders = new Map<string, string>();
    private folderSyncPromise: Promise<void> = Promise.resolve();
    private readonly diskContents = new Map<string, string>();
    private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
    private currentTransactionOrigin: unknown = null;
    private destroyed = false;
    private isReconciling = false;
    private synchronized = false;
    private readonly ownsDoc: boolean;
    public reconciliationPromise: Promise<void> | null = null;

    constructor(options: WorkspaceSyncBridgeOptions) {
        this.workspaceId = options.workspaceId;
        this.roomId = options.roomId ?? options.workspaceId;
        this.hostWorkspacePath = options.hostWorkspacePath;
        this.storage = options.storage;
        this.watcher = options.watcher;
        this.debounceMs = options.debounceMs ?? 300;

        const serverUrl =
            options.syncServerUrl ??
            process.env["SYNC_SERVER_URL"] ??
            "http://localhost:4000";

        this.ownsDoc = options.customDoc === undefined;
        this.doc = options.customDoc ?? new Y.Doc();
        this.awareness = new Awareness(this.doc);

        this.socket =
            options.customSocket ??
            (io(serverUrl, {
                transports: ["websocket"],
                reconnection: true,
            }) as Socket<SyncServerToClientEvents, SyncClientToServerEvents>);

        this.workspace = createWorkspace(
            { id: this.workspaceId, name: "Workspace" },
            this.doc,
        );
        this.provider = new TesseraSocketProvider({
            socket: this.socket,
            ydoc: this.doc,
            awareness: this.awareness,
        });
        // The provider applies sync-step-2 before this listener reconciles disk.
        this.socket.on("sync-step-2", this.handleSynchronized);
        this.socket.on("disconnect", this.handleDisconnect);
        this.socket.on("connect", this.joinAndSync);

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

        this.doc.on("beforeTransaction", this.handleBeforeTransaction);
        this.doc.on("afterTransaction", this.handleAfterTransaction);
        if (this.socket.connected) {
            this.joinAndSync();
        }
    }

    private readonly joinAndSync = (): void => {
        this.synchronized = false;
        const participant: Participant = {
            id: `engine-${this.workspaceId}`,
            displayName: "Filesystem Engine",
            cursorColor: "#64748b",
            isAI: false,
        };
        this.socket.emit("join-room", { roomId: this.roomId, participant });
        this.socket.emit("sync-step-1", Y.encodeStateVector(this.doc));
    };

    private readonly handleSynchronized = (): void => {
        if (this.destroyed) {
            return;
        }
        this.synchronized = true;
        if (!this.isReconciling) {
            this.reconciliationPromise = this.reconcileInitialState();
        }
    };

    private readonly handleDisconnect = (): void => {
        this.synchronized = false;
    };

    private readonly handleBeforeTransaction = (transaction: Y.Transaction): void => {
        this.currentTransactionOrigin = transaction.origin;
    };

    private readonly handleAfterTransaction = (): void => {
        this.currentTransactionOrigin = null;
    };

    private async handleFsEvent(event: FsWatchEvent): Promise<void> {
        if (this.destroyed) {
            return;
        }

        const cleanPath = event.path.replace(/^\/+/, "").trim();
        if (!cleanPath) {
            return;
        }

        if ((event.type === "add" || event.type === "change") && typeof event.content === "string") {
            if (this.diskContents.get(cleanPath) === event.content) {
                return;
            }
            this.diskContents.set(cleanPath, event.content);
        } else if (event.type === "unlink") {
            this.diskContents.delete(cleanPath);
        }

        console.log(`[WorkspaceSyncBridge] Inbound disk event: ${event.type} ${cleanPath}`);

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
            await this.folderSyncPromise;
            const diskEntries = await this.storage.listEntries(this.workspaceId);
            const diskFiles = diskEntries.files;
            const diskFolderSet = new Set(diskEntries.folders);
            const initialFolders = this.workspace.getFolders();
            for (const folder of initialFolders) {
                const relPath = getRelativeFolderPath(folder, initialFolders);
                if (!diskFolderSet.has(relPath)) {
                    await this.storage.createFolder(this.workspaceId, relPath);
                }
                this.trackedFolders.set(folder.id, relPath);
            }
            this.doc.transact(() => {
                for (const folderPath of diskEntries.folders) {
                    ensureFolderHierarchy(folderPath, this.workspace);
                }
            }, FS_ORIGIN);
            for (const folder of this.workspace.getFolders()) {
                const relPath = getRelativeFolderPath(folder, this.workspace.getFolders());
                if (diskFolderSet.has(relPath)) {
                    this.trackedFolders.set(folder.id, relPath);
                }
            }
            const diskFileSet = new Set(diskFiles);
            const crdtFiles = this.workspace.getFiles();
            const folders = this.workspace.getFolders();
            const crdtFileMap = new Map<string, typeof crdtFiles[0]>();
            const crdtContents = new Map<string, string>();

            for (const file of crdtFiles) {
                const relPath = getRelativeFilePath(file, folders);
                crdtFileMap.set(relPath, file);
                crdtContents.set(relPath, this.workspace.getFileContent(file.id) ?? "");
            }

            // Case 1: File in CRDT but not on disk -> populate disk
            for (const [relPath, file] of crdtFileMap.entries()) {
                if (!diskFileSet.has(relPath)) {
                    const content = this.workspace.getFileContent(file.id) ?? "";
                    this.diskContents.set(relPath, content);
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
                        this.diskContents.set(diskRelPath, content);
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
                        const contentBeforeRead = crdtContents.get(relPath) ?? "";
                        const diskContent = await this.storage.readFile(this.workspaceId, relPath);
                        this.diskContents.set(relPath, diskContent);
                        const crdtContent = this.workspace.getFileContent(file.id) ?? "";
                        if (diskContent !== crdtContent && crdtContent === contentBeforeRead) {
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
            if (!this.destroyed) {
                this.handleFilesChanged();
                this.handleFoldersChanged();
                for (const file of this.workspace.getFiles()) {
                    const relPath = getRelativeFilePath(file, this.workspace.getFolders());
                    if (this.diskContents.get(relPath) !== this.workspace.getFileContent(file.id)) {
                        this.scheduleDebouncedDiskWrite(file.id);
                    }
                }
            }
        }
    }

    private scheduleDebouncedDiskWrite(fileId: string): void {
        if (!this.synchronized || this.isReconciling || this.destroyed) {
            return;
        }
        const existingTimer = this.debounceTimers.get(fileId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
            this.debounceTimers.delete(fileId);
            if (this.destroyed || !this.synchronized || this.isReconciling) {
                return;
            }

            await this.folderSyncPromise;
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

            const previousContent = this.diskContents.get(relPath);
            this.diskContents.set(relPath, content);
            this.watcher.markRecentWrite(relPath, content);
            try {
                await this.storage.writeFiles(this.workspaceId, [
                    { path: relPath, content },
                ]);
                console.log(`[WorkspaceSyncBridge] Successfully synced ${relPath} to disk`);
            } catch (err: unknown) {
                if (previousContent === undefined) {
                    this.diskContents.delete(relPath);
                } else {
                    this.diskContents.set(relPath, previousContent);
                }
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
        if (!this.synchronized || this.isReconciling) {
            return;
        }
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
                    this.diskContents.delete(oldPath);
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
                    this.diskContents.delete(oldPath);
                    this.watcher.markRecentWrite(oldPath);
                    void this.storage.deletePath(this.workspaceId, oldPath).catch(() => {});
                }
            }
        }
    }

    private handleFoldersChanged(): void {
        if (!this.synchronized || this.isReconciling) {
            return;
        }
        const folders = this.workspace.getFolders();
        const currentPaths = new Map(folders.map((folder) => [
            folder.id, getRelativeFolderPath(folder, folders),
        ]));
        const previousPaths = new Map(this.trackedFolders);
        this.trackedFolders.clear();
        for (const [id, folderPath] of currentPaths) {
            this.trackedFolders.set(id, folderPath);
        }
        for (const file of this.workspace.getFiles()) {
            this.trackedFiles.set(file.id, getRelativeFilePath(file, folders));
        }
        if (this.currentTransactionOrigin === FS_ORIGIN) {
            return;
        }

        this.folderSyncPromise = this.folderSyncPromise.then(async () => {
            if (this.destroyed) {
                return;
            }
            const renamedPaths: [string, string][] = [];
            const orderedFolders = [...currentPaths].sort((a, b) =>
                a[1].split("/").length - b[1].split("/").length,
            );
            for (const [id, newPath] of orderedFolders) {
                const originalPath = previousPaths.get(id);
                if (originalPath && originalPath !== newPath) {
                    let sourcePath = originalPath;
                    for (const [oldPrefix, newPrefix] of renamedPaths) {
                        if (sourcePath === oldPrefix || sourcePath.startsWith(`${oldPrefix}/`)) {
                            sourcePath = newPrefix + sourcePath.slice(oldPrefix.length);
                        }
                    }
                    if (sourcePath !== newPath) {
                        for (const [filePath, content] of [...this.diskContents]) {
                            if (filePath.startsWith(`${sourcePath}/`)) {
                                this.diskContents.delete(filePath);
                                this.diskContents.set(newPath + filePath.slice(sourcePath.length), content);
                            }
                        }
                        await this.storage.renamePath(this.workspaceId, sourcePath, newPath);
                        renamedPaths.push([sourcePath, newPath]);
                    }
                } else if (!originalPath) {
                    await this.storage.createFolder(this.workspaceId, newPath);
                }
            }
            const removedPaths = [...previousPaths]
                .filter(([id]) => !currentPaths.has(id))
                .map(([, folderPath]) => folderPath);
            for (const folderPath of removedPaths) {
                if (!removedPaths.some((parent) => folderPath.startsWith(`${parent}/`))) {
                    this.watcher.markRecentWrite(folderPath);
                    await this.storage.deletePath(this.workspaceId, folderPath);
                }
            }
        }).catch((error: unknown) => {
            console.error(`Failed to sync folders for workspace ${this.workspaceId}:`, error);
        });
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
        await this.folderSyncPromise;
        this.trackedFiles.clear();
        this.trackedFolders.clear();
        this.diskContents.clear();

        this.unsubscribeWatcher();
        this.unsubscribeFiles();
        this.unsubscribeFolders();

        this.socket.off("connect", this.joinAndSync);
        this.socket.off("disconnect", this.handleDisconnect);
        this.socket.off("sync-step-2", this.handleSynchronized);
        this.doc.off("beforeTransaction", this.handleBeforeTransaction);
        this.doc.off("afterTransaction", this.handleAfterTransaction);
        this.provider.destroy();
        this.awareness.destroy();
        this.socket.disconnect();
        if (this.ownsDoc) {
            this.doc.destroy();
        }
    }
}
