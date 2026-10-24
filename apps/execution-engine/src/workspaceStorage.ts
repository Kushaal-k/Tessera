import * as fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import * as path from "node:path";
import type { ExecutionFile } from "@tessera/shared-types";

export interface WorkspaceStorageOptions {
    readonly baseDir?: string;
}

const SAFE_WORKSPACE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export class WorkspaceStorage {
    private readonly baseDir: string;

    constructor(options: WorkspaceStorageOptions = {}) {
        this.baseDir = options.baseDir ??
            process.env["TESSERA_WORKSPACE_ROOT"] ?? 
            "/tmp/tessera-workspaces";
    }

    public validateWorkspaceId(workspaceId: string): void {
        if (!workspaceId || typeof workspaceId !== "string") {
            throw new Error("Invalid workspace ID: must be a non-empty string");
        }

        if (!SAFE_WORKSPACE_ID_REGEX.test(workspaceId)) {
            throw new Error(`Invalid workspace ID "${workspaceId}": must contain only alphanumeric characters, dashes, and underscores`);
        }
    }

    public getWorkspacePath(workspaceId: string): string {
        this.validateWorkspaceId(workspaceId);
        return path.resolve(this.baseDir, workspaceId);
    }

    public resolveSafePath(workspaceId: string, relativePath: string): string {
        this.validateWorkspaceId(workspaceId);

        if (!relativePath || typeof relativePath !== "string") {
            throw new Error("Invalid file path: path must be a non-empty string");
        }

        if (relativePath.includes("\0")) {
            throw new Error("Path traversal attempt detected: null byte in path");
        }

        if (path.isAbsolute(relativePath)) {
            throw new Error(`Path traversal attempt detected in file path: ${relativePath}`);
        }

        const normalizedRelativePath = path.normalize(relativePath);
        if (normalizedRelativePath.startsWith("..") || path.isAbsolute(normalizedRelativePath)) {
            throw new Error(`Path traversal attempt detected in file path: ${relativePath}`);
        }

        const workspacePath = this.getWorkspacePath(workspaceId);
        const targetPath = path.resolve(workspacePath, normalizedRelativePath);

        if (!targetPath.startsWith(workspacePath + path.sep)) {
            throw new Error(`Path traversal attempt detected: ${relativePath} escapes workspace boundary`);
        }

        return targetPath;
    }

    public async assertPathContainment(workspaceId: string, relativePath: string): Promise<string> {
        const targetPath = this.resolveSafePath(workspaceId, relativePath);
        const workspacePath = this.getWorkspacePath(workspaceId);

        let realWorkspacePath: string;
        try {
            realWorkspacePath = await fs.realpath(workspacePath);
        } catch {
            return targetPath;
        }

        const normalized = path.normalize(relativePath);
        const parts = normalized.split(path.sep).filter((p) => {
            return p.length > 0 && p !== ".";
        });

        let current = realWorkspacePath;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i]!;
            const next = path.join(current, part);
            let lstat: import("node:fs").Stats;
            try {
                lstat = await fs.lstat(next);
            } catch (err: unknown) {
                const code = (err as NodeJS.ErrnoException).code;
                if (code === "ENOENT") {
                    const remaining = parts.slice(i).join(path.sep);
                    const projected = path.resolve(current, remaining);
                    if (projected !== realWorkspacePath && !projected.startsWith(realWorkspacePath + path.sep)) {
                        throw new Error(`Path traversal attempt detected: projection escapes workspace boundary: ${relativePath}`);
                    }
                    return targetPath;
                }
                throw err;
            }

            if (lstat.isSymbolicLink()) {
                let realTarget: string;
                try {
                    realTarget = await fs.realpath(next);
                } catch {
                    throw new Error(`Path traversal attempt detected: broken symlink in path: ${part}`);
                }
                if (realTarget !== realWorkspacePath && !realTarget.startsWith(realWorkspacePath + path.sep)) {
                    throw new Error(`Path traversal attempt detected: symlink escapes workspace boundary: ${part}`);
                }
                current = realTarget;
            } else if (lstat.isDirectory()) {
                const realDir = await fs.realpath(next);
                if (realDir !== realWorkspacePath && !realDir.startsWith(realWorkspacePath + path.sep)) {
                    throw new Error(`Path traversal attempt detected: directory escapes workspace boundary: ${part}`);
                }
                current = realDir;
            } else {
                const realFile = await fs.realpath(next);
                if (realFile !== realWorkspacePath && !realFile.startsWith(realWorkspacePath + path.sep)) {
                    throw new Error(`Path traversal attempt detected: file escapes workspace boundary: ${part}`);
                }
                current = realFile;
            }
        }

        return targetPath;
    }

    public async checkSymlinkContainment(workspaceId: string, targetPath: string): Promise<boolean> {
        try {
            const workspacePath = this.getWorkspacePath(workspaceId);
            const relativePath = path.isAbsolute(targetPath)
                ? path.relative(workspacePath, targetPath)
                : targetPath;
            await this.assertPathContainment(workspaceId, relativePath);
            return true;
        } catch {
            return false;
        }
    }

    public async initWorkspace(
        workspaceId: string,
        initialFiles?: readonly ExecutionFile[]
    ): Promise<string> {
        const workspacePath = this.getWorkspacePath(workspaceId);

        await fs.mkdir(workspacePath, { recursive: true, mode: 0o777 });

        try {
            await fs.chown(workspacePath, 1000, 1000);
        } catch {
            await fs.chmod(workspacePath, 0o777);
        }

        if (initialFiles && initialFiles.length > 0) {
            await this.writeFiles(workspaceId, initialFiles);
        }

        return workspacePath;
    }

    public async writeFiles(
        workspaceId: string,
        files: readonly ExecutionFile[]
    ): Promise<void> {
        const workspacePath = this.getWorkspacePath(workspaceId);
        const realWorkspacePath = await fs.realpath(workspacePath).catch(() => {
            return workspacePath;
        });

        for (const file of files) {
            await this.assertPathContainment(workspaceId, file.path);
            const targetPath = this.resolveSafePath(workspaceId, file.path);
            const parentDir = path.dirname(targetPath);

            await fs.mkdir(parentDir, { recursive: true, mode: 0o777 });

            const realParent = await fs.realpath(parentDir);
            if (realParent !== realWorkspacePath && !realParent.startsWith(realWorkspacePath + path.sep)) {
                throw new Error("Path traversal attempt detected: parent directory escapes workspace boundary");
            }

            const handle = await fs.open(targetPath, fsConstants.O_WRONLY | fsConstants.O_CREAT, 0o666);
            try {
                const realFdPath = await this.resolveFdRealPath(handle.fd, targetPath);
                if (realFdPath !== realWorkspacePath && !realFdPath.startsWith(realWorkspacePath + path.sep)) {
                    throw new Error("Path traversal attempt detected: opened file escapes workspace boundary");
                }
                await handle.truncate(0);
                await handle.writeFile(file.content, { encoding: "utf-8" });
            } finally {
                await handle.close();
            }

            const finalReal = await fs.realpath(targetPath);
            if (finalReal !== realWorkspacePath && !finalReal.startsWith(realWorkspacePath + path.sep)) {
                throw new Error("Path traversal attempt detected: written file escapes workspace boundary");
            }

            try {
                await fs.chown(targetPath, 1000, 1000);
            } catch {
                try {
                    await fs.chmod(targetPath, 0o666);
                } catch {
                    // Ignore if file was concurrently removed
                }
            }
        }
    }

    public async createFolder(workspaceId: string, relativePath: string): Promise<string> {
        await this.assertPathContainment(workspaceId, relativePath);
        const targetPath = this.resolveSafePath(workspaceId, relativePath);
        const workspacePath = this.getWorkspacePath(workspaceId);
        const realWorkspacePath = await fs.realpath(workspacePath).catch(() => {
            return workspacePath;
        });

        await fs.mkdir(targetPath, { recursive: true, mode: 0o777 });

        const realTarget = await fs.realpath(targetPath);
        if (realTarget !== realWorkspacePath && !realTarget.startsWith(realWorkspacePath + path.sep)) {
            throw new Error("Path traversal attempt detected: created folder escapes workspace boundary");
        }

        try {
            await fs.chown(targetPath, 1000, 1000);
        } catch {
            try {
                await fs.chmod(targetPath, 0o777);
            } catch {
                // Ignore if folder was concurrently removed
            }
        }
        return targetPath;
    }

    public async deletePath(workspaceId: string, relativePath: string): Promise<void> {
        if (!relativePath || relativePath.trim() === "" || relativePath.trim() === ".") {
            throw new Error("Cannot delete workspace root directory via deletePath");
        }

        const targetPath = this.resolveSafePath(workspaceId, relativePath);
        const workspacePath = this.getWorkspacePath(workspaceId);

        if (targetPath === workspacePath) {
            throw new Error("Cannot delete workspace root directory via deletePath");
        }

        await this.assertPathContainment(workspaceId, relativePath);

        const realWorkspacePath = await fs.realpath(workspacePath).catch(() => {
            return workspacePath;
        });

        let isSymlink = false;
        try {
            const lstat = await fs.lstat(targetPath);
            isSymlink = lstat.isSymbolicLink();
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                return;
            }
            throw err;
        }

        if (isSymlink) {
            await fs.unlink(targetPath);
            return;
        }

        const realTarget = await fs.realpath(targetPath);
        if (realTarget !== realWorkspacePath && !realTarget.startsWith(realWorkspacePath + path.sep)) {
            throw new Error("Path traversal attempt detected: target escapes workspace boundary");
        }

        await fs.rm(targetPath, { recursive: true, force: true });
    }

    public async deleteWorkspace(workspaceId: string): Promise<void> {
        const workspacePath = this.getWorkspacePath(workspaceId);
        await fs.rm(workspacePath, { recursive: true, force: true });
    }

    public async isWorkspaceInitialized(workspaceId: string): Promise<boolean> {
        const workspacePath = this.getWorkspacePath(workspaceId);
        try {
            const stats = await fs.stat(workspacePath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    public async listFiles(workspaceId: string): Promise<string[]> {
        return (await this.listEntries(workspaceId)).files;
    }

    public async listEntries(workspaceId: string): Promise<{ files: string[]; folders: string[] }> {
        const workspacePath = this.getWorkspacePath(workspaceId);
        const results: string[] = [];
        const folders: string[] = [];

        let realWorkspacePath: string;
        try {
            realWorkspacePath = await fs.realpath(workspacePath);
        } catch {
            return { files: results, folders };
        }

        const walk = async (currentDir: string): Promise<void> => {
            let entries: import("node:fs").Dirent[] = [];
            try {
                entries = await fs.readdir(currentDir, { withFileTypes: true });
            } catch {
                return;
            }

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                const relPath = path.relative(workspacePath, fullPath);

                if (!relPath || relPath.startsWith("..")) {
                    continue;
                }

                if (
                    entry.name === "node_modules" ||
                    entry.name === ".git" ||
                    entry.name === ".npm" ||
                    entry.name === "dist" ||
                    entry.name === ".turbo" ||
                    entry.name === ".cache" ||
                    entry.name === ".DS_Store"
                ) {
                    continue;
                }

                try {
                    const realEntry = await fs.realpath(fullPath);
                    if (realEntry !== realWorkspacePath && !realEntry.startsWith(realWorkspacePath + path.sep)) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        folders.push(relPath);
                        await walk(fullPath);
                    } else if (entry.isFile()) {
                        results.push(relPath);
                    } else if (entry.isSymbolicLink()) {
                        const stat = await fs.stat(fullPath);
                        if (stat.isFile()) {
                            results.push(relPath);
                        } else if (stat.isDirectory()) {
                            folders.push(relPath);
                        }
                    }
                } catch {
                    continue;
                }
            }
        };

        await walk(workspacePath);
        return { files: results, folders };
    }

    public async renamePath(workspaceId: string, oldPath: string, newPath: string): Promise<void> {
        if (!oldPath || oldPath.trim() === "" || oldPath.trim() === "." ||
            !newPath || newPath.trim() === "" || newPath.trim() === ".") {
            throw new Error("Cannot operate on workspace root directory");
        }

        const source = this.resolveSafePath(workspaceId, oldPath);
        const target = this.resolveSafePath(workspaceId, newPath);
        const workspacePath = this.getWorkspacePath(workspaceId);

        if (source === workspacePath || target === workspacePath) {
            throw new Error("Cannot operate on workspace root directory");
        }

        await this.assertPathContainment(workspaceId, oldPath);
        await this.assertPathContainment(workspaceId, newPath);

        const realWorkspacePath = await fs.realpath(workspacePath).catch(() => {
            return workspacePath;
        });

        const sourceLstat = await fs.lstat(source);
        if (!sourceLstat.isSymbolicLink()) {
            const realSource = await fs.realpath(source);
            if (realSource !== realWorkspacePath && !realSource.startsWith(realWorkspacePath + path.sep)) {
                throw new Error("Path traversal attempt detected: rename source escapes workspace boundary");
            }
        }

        const targetParent = path.dirname(target);
        await fs.mkdir(targetParent, { recursive: true, mode: 0o777 });

        const realTargetParent = await fs.realpath(targetParent);
        if (realTargetParent !== realWorkspacePath && !realTargetParent.startsWith(realWorkspacePath + path.sep)) {
            throw new Error("Path traversal attempt detected: rename target parent escapes workspace boundary");
        }

        try {
            const targetLstat = await fs.lstat(target);
            if (targetLstat.isSymbolicLink()) {
                let realTarget: string;
                try {
                    realTarget = await fs.realpath(target);
                } catch {
                    throw new Error("Path traversal attempt detected: target is a broken symlink");
                }
                if (realTarget !== realWorkspacePath && !realTarget.startsWith(realWorkspacePath + path.sep)) {
                    throw new Error("Path traversal attempt detected: target symlink escapes workspace boundary");
                }
            }
        } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
                throw err;
            }
        }

        await fs.rename(source, target);

        try {
            const finalLstat = await fs.lstat(target);
            if (!finalLstat.isSymbolicLink()) {
                const finalReal = await fs.realpath(target);
                if (finalReal !== realWorkspacePath && !finalReal.startsWith(realWorkspacePath + path.sep)) {
                    throw new Error("Path traversal attempt detected: renamed path escapes workspace boundary");
                }
            }
        } catch {
            // Target was concurrently removed or renamed
        }
    }

    public async readFile(workspaceId: string, relativePath: string): Promise<string> {
        await this.assertPathContainment(workspaceId, relativePath);
        const targetPath = this.resolveSafePath(workspaceId, relativePath);
        const workspacePath = this.getWorkspacePath(workspaceId);
        const realWorkspacePath = await fs.realpath(workspacePath).catch(() => {
            return workspacePath;
        });

        const handle = await fs.open(targetPath, "r");
        try {
            const realFdPath = await this.resolveFdRealPath(handle.fd, targetPath);
            if (realFdPath !== realWorkspacePath && !realFdPath.startsWith(realWorkspacePath + path.sep)) {
                throw new Error("Path traversal attempt detected: opened file escapes workspace boundary");
            }
            return await handle.readFile({ encoding: "utf-8" });
        } finally {
            await handle.close();
        }
    }

    private async resolveFdRealPath(fd: number, fallbackPath: string): Promise<string> {
        try {
            return await fs.realpath(`/proc/self/fd/${fd}`);
        } catch {
            return await fs.realpath(fallbackPath);
        }
    }
}
