import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as chokidar from "chokidar";
import type { FsWatchEvent, FsWatchEventType } from "@tessera/shared-types";

export type FsWatchListener = (event: FsWatchEvent) => void;

export interface FsWatcherOptions {
    readonly debounceMs?: number;
    readonly echoSuppressTtlMs?: number;
    readonly maxFileSize?: number;
}

export const MAX_SYNC_FILE_SIZE = 2 * 1024 * 1024; // 2MB

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

export function computeContentHash(content: string | Buffer): string {
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function isBinaryBuffer(buffer: Buffer): boolean {
    const checkLength = Math.min(buffer.length, 512);
    for (let i = 0; i < checkLength; i++) {
        if (buffer[i] === 0) {
            return true;
        }
    }
    return false;
}

interface WriteToken {
    readonly hash: string;
    readonly expiresAt: number;
}

export class FsWatcher {
    public readonly workspaceId: string;
    public readonly rootDir: string;
    private readonly debounceMs: number;
    private readonly echoSuppressTtlMs: number;
    private readonly maxFileSize: number;
    private readonly listeners = new Set<FsWatchListener>();
    private readonly pendingTokens = new Map<string, WriteToken[]>();
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
        this.echoSuppressTtlMs = options.echoSuppressTtlMs ?? 1000;
        this.maxFileSize = options.maxFileSize ?? MAX_SYNC_FILE_SIZE;
    }

    public isWatching(): boolean {
        return this.watcher !== null;
    }

    public markRecentWrite(relativePath: string, content?: string | Buffer): void {
        const normalized = path.normalize(relativePath).replace(/^\/+/, "");
        const hash = content !== undefined ? computeContentHash(content) : "*";
        const token: WriteToken = {
            hash,
            expiresAt: Date.now() + this.echoSuppressTtlMs,
        };

        const existing = this.pendingTokens.get(normalized);
        if (existing) {
            existing.push(token);
        } else {
            this.pendingTokens.set(normalized, [token]);
        }
    }

    public shouldSuppress(relativePath: string, content?: string | Buffer): boolean {
        const normalized = path.normalize(relativePath).replace(/^\/+/, "");
        const tokens = this.pendingTokens.get(normalized);

        if (!tokens || tokens.length === 0) {
            return false;
        }

        const now = Date.now();
        // Purge expired tokens
        const validTokens = tokens.filter((t) => t.expiresAt > now);
        if (validTokens.length === 0) {
            this.pendingTokens.delete(normalized);
            return false;
        }

        const currentHash = content !== undefined ? computeContentHash(content) : undefined;

        // If wildcard exists (e.g. for deletions), consume one-shot
        const wildcardIndex = validTokens.findIndex((t) => t.hash === "*");
        if (wildcardIndex !== -1) {
            validTokens.splice(wildcardIndex, 1);
            if (validTokens.length === 0) {
                this.pendingTokens.delete(normalized);
            } else {
                this.pendingTokens.set(normalized, validTokens);
            }
            return true;
        }

        // If matching hash exists, consume one-shot
        if (currentHash !== undefined) {
            const matchIndex = validTokens.findIndex((t) => t.hash === currentHash);
            if (matchIndex !== -1) {
                validTokens.splice(matchIndex, 1);
                if (validTokens.length === 0) {
                    this.pendingTokens.delete(normalized);
                } else {
                    this.pendingTokens.set(normalized, validTokens);
                }
                return true;
            }
        }

        this.pendingTokens.set(normalized, validTokens);
        return false;
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

        const handleRawEvent = async (type: FsWatchEventType, rawPath: string): Promise<void> => {
            const relative = path.normalize(path.relative(this.rootDir, rawPath));

            if (!relative || relative === "." || relative.startsWith("..")) {
                return;
            }

            if (isCleanBoundaryIgnored(relative)) {
                return;
            }

            const absPath = path.resolve(this.rootDir, relative);

            // Symlink containment check
            try {
                const lstat = await fs.lstat(absPath);
                if (lstat.isSymbolicLink()) {
                    const real = await fs.realpath(absPath);
                    if (!real.startsWith(this.rootDir + path.sep)) {
                        return;
                    }
                }
            } catch {
                // If path doesn't exist anymore, proceed to unlink handling
            }

            let content: string | undefined;
            if (type === "add" || type === "change") {
                try {
                    const stat = await fs.stat(absPath);
                    if (stat.isDirectory()) {
                        return;
                    }
                    if (stat.size > this.maxFileSize) {
                        // Skip reading content for oversized files to prevent OOM
                        return;
                    }

                    const buffer = await fs.readFile(absPath);
                    if (isBinaryBuffer(buffer)) {
                        // Binary files must not be ingested into text CRDT buffers
                        return;
                    }

                    content = buffer.toString("utf-8");
                } catch {
                    // File might have been deleted right after event
                    return;
                }
            }

            if (this.shouldSuppress(relative, content)) {
                return;
            }

            this.dispatchDebounced({
                type,
                path: relative,
                workspaceId: this.workspaceId,
                content,
            });
        };

        this.watcher.on("add", (p: string) => {
            void handleRawEvent("add", p);
        });

        this.watcher.on("change", (p: string) => {
            void handleRawEvent("change", p);
        });

        this.watcher.on("unlink", (p: string) => {
            void handleRawEvent("unlink", p);
        });

        this.watcher.on("addDir", (p: string) => {
            void handleRawEvent("addDir", p);
        });

        this.watcher.on("unlinkDir", (p: string) => {
            void handleRawEvent("unlinkDir", p);
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
        this.pendingTokens.clear();
        this.listeners.clear();

        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    }
}

export type { FsWatchEvent, FsWatchEventType };
