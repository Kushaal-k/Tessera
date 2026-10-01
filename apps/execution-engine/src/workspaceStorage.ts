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

        for (const file of files) {
            if (path.isAbsolute(file.path)) {
                throw new Error(`Path traversal attempt detected in file path: ${file.path}`);
            }

            const normalizedRelativePath = path.normalize(file.path);

            if (normalizedRelativePath.startsWith("..") || path.isAbsolute(normalizedRelativePath)) {
                throw new Error(`Path traversal attempt detected in file path: ${file.path}`);
            }

            const targetPath = path.resolve(workspacePath, normalizedRelativePath);

            if (!targetPath.startsWith(workspacePath + path.sep) && targetPath !== workspacePath) {
                throw new Error(`Path traversal attempt detected: ${file.path}`);
            }

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