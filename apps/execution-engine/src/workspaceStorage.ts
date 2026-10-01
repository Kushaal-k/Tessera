import * as fs from "node:fs/promises";
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

    public async checkSymlinkContainment(workspaceId: string, targetPath: string): Promise<boolean> {
        const workspacePath = this.getWorkspacePath(workspaceId);
        try {
            const lstat = await fs.lstat(targetPath);
            if (lstat.isSymbolicLink()) {
                const realPath = await fs.realpath(targetPath);
                return realPath.startsWith(workspacePath + path.sep);
            }
            return true;
        } catch {
            return true;
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
        for (const file of files) {
            const targetPath = this.resolveSafePath(workspaceId, file.path);
            const parentDir = path.dirname(targetPath);
            await fs.mkdir(parentDir, { recursive: true, mode: 0o777 });

            await fs.writeFile(targetPath, file.content, {
                encoding: "utf-8",
                mode: 0o666,
            });

            try {
                await fs.chown(targetPath, 1000, 1000);
            } catch {
                // Non-root host environments throw EPERM
                await fs.chmod(targetPath, 0o666);
            }
        }
    }

    public async createFolder(workspaceId: string, relativePath: string): Promise<string> {
        const targetPath = this.resolveSafePath(workspaceId, relativePath);
        await fs.mkdir(targetPath, { recursive: true, mode: 0o777 });
        try {
            await fs.chown(targetPath, 1000, 1000);
        } catch {
            await fs.chmod(targetPath, 0o777);
        }
        return targetPath;
    }

    public async deletePath(workspaceId: string, relativePath: string): Promise<void> {
        const targetPath = this.resolveSafePath(workspaceId, relativePath);
        const workspacePath = this.getWorkspacePath(workspaceId);

        if (targetPath === workspacePath) {
            throw new Error("Cannot delete workspace root directory via deletePath");
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
}