import * as path from "node:path";
import * as chokidar from "chokidar";

export type FsWatchEventType = "add" | "change" | "unlink" | "addDir" | "unlinkDir";

export interface FsWatchEvent {
    readonly type: FsWatchEventType;
    readonly path: string;
    readonly workspaceId: string;
}

export type FsWatchListener = (event: FsWatchEvent) => void;

export interface FsWatcherOptions {
    readonly debounceMs?: number;
    readonly echoSuppressTtlMs?: number;
}

export const CLEAN_BOUNDARY_PATTERNS: readonly RegExp[] = [
    /(?:^|[\\/])node_modules(?:[\\/]|$)/,
    /(?:^|[\\/])\.git(?:[\\/]|$)/,
    /(?:^|[\\/])\.npm(?:[\\/]|$)/,
    /(?:^|[\\/])dist(?:[\\/]|$)/,
    /(?:^|[\\/])\.turbo(?:[\\/]|$)/,
    /(?:^|[\\/])\.cache(?:[\\/]|$)/,
    /(?:^|[\\/])\.DS_Store$/,
];

export function isCleanBoundaryIgnored(targetPath: string): boolean {
    for (const pattern of CLEAN_BOUNDARY_PATTERNS) {
        if (pattern.test(targetPath)) {
            return true;
        }
    }

    return false;
}

interface RecentWriteRecord {
    readonly expiresAt: number;
    readonly hash?: string;
}

export class FsWatcher {
    public readonly workspaceId: string;
    public readonly rootDir: string;
    private readonly debounceMs: number;
    private readonly echoSuppressTtlMs: number;
    private readonly listeners = new Set<FsWatchListener>();
    private readonly recentWrites = new Map<string, RecentWriteRecord>();
    private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
    private watcher: chokidar.FSWatcher | null = null;

    constructor(
        workspaceId: string,
        rootDir: string,
        options: FsWatcherOptions = {},
    ) {
        this.workspaceId = workspaceId;
        this.rootDir = path.resolve(rootDir);
        this.debounceMs = options.debounceMs ?? 50;
        this.echoSuppressTtlMs = options.echoSuppressTtlMs ?? 500;
    }

    public isWatching(): boolean {
        return this.watcher !== null;
    }

    public markRecentWrite(relativePath: string, contentHash?: string): void {
        const normalized = path.normalize(relativePath).replace(/^\/+/, "");
        this.recentWrites.set(normalized, {
            expiresAt: Date.now() + this.echoSuppressTtlMs,
            hash: contentHash,
        });
    }

    public shouldSuppress(relativePath: string, currentContentHash?: string): boolean {
        const normalized = path.normalize(relativePath).replace(/^\/+/, "");

        const record = this.recentWrites.get(normalized);

        if (!record) {
            return false;
        }

        if (Date.now() > record.expiresAt) {
            this.recentWrites.delete(normalized);
            return false;
        }

        if (record.hash && currentContentHash && record.hash !== currentContentHash) {
            return false;
        }

        return true;
    }

    public onEvent(listener: FsWatchListener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    public async waitUntilReady(): Promise<void> {
        if (!this.watcher) {
            return;
        }

        return new Promise((resolve) => {
            this.watcher?.on("ready", () => {
                resolve();
            });
        });
    }

    public start(): void {
        if (this.watcher) {
            return;
        }

        this.watcher = chokidar.watch(this.rootDir, {
            ignored: (targetPath: string) => {
                const relative = path.relative(this.rootDir, targetPath);
                if (!relative || relative === ".") {
                    return false;
                }
                return isCleanBoundaryIgnored(relative);
            },
            persistent: true,
            ignoreInitial: true,
            depth: 20,
        });

        const handleRawEvent = (type: FsWatchEventType, rawPath: string): void => {
            const relative = path.normalize(path.relative(this.rootDir, rawPath));

            if (!relative || relative === "." || relative.startsWith("..")) {
                return;
            }

            if (isCleanBoundaryIgnored(relative)) {
                return;
            }

            if (this.shouldSuppress(relative)) {
                return;
            }

            this.dispatchDebounced({
                type,
                path: relative,
                workspaceId: this.workspaceId,
            });
        };

        this.watcher.on("add", (p: string) => {
            handleRawEvent("add", p);
        });

        this.watcher.on("change", (p: string) => {
            handleRawEvent("change", p);
        });

        this.watcher.on("unlink", (p: string) => {
            handleRawEvent("unlink", p);
        });

        this.watcher.on("addDir", (p: string) => {
            handleRawEvent("addDir", p);
        });

        this.watcher.on("unlinkDir", (p: string) => {
            handleRawEvent("unlinkDir", p);
        });
    }

    private dispatchDebounced(event: FsWatchEvent): void {
        const existingTimer = this.debounceTimers.get(event.path);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
            this.debounceTimers.delete(event.path);
            for (const listener of this.listeners) {
                listener(event);
            }
        }, this.debounceMs);

        this.debounceTimers.set(event.path, timer);
    }

    public async stop(): Promise<void> {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        this.recentWrites.clear();
        this.listeners.clear();

        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    }
}
