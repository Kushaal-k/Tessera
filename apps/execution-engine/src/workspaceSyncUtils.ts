import type {
    WorkspaceFile,
    WorkspaceFolder,
} from "@tessera/shared-types";
import type { Workspace } from "@tessera/collaboration";

export function getRelativeFilePath(
    file: { name: string; parentId: string | null },
    folders: readonly WorkspaceFolder[],
): string {
    const parts: string[] = [file.name];
    let currentParentId = file.parentId;
    const folderMap = new Map(folders.map((f) => [f.id, f]));

    while (currentParentId) {
        const parentFolder = folderMap.get(currentParentId);
        if (!parentFolder) {
            break;
        }
        parts.unshift(parentFolder.name);
        currentParentId = parentFolder.parentId;
    }

    return parts.join("/");
}

export function getRelativeFolderPath(
    folder: WorkspaceFolder,
    allFolders: readonly WorkspaceFolder[],
): string {
    const parts: string[] = [folder.name];
    let currentParentId = folder.parentId;
    const folderMap = new Map(allFolders.map((f) => [f.id, f]));

    while (currentParentId) {
        const parent = folderMap.get(currentParentId);
        if (!parent) {
            break;
        }
        parts.unshift(parent.name);
        currentParentId = parent.parentId;
    }

    return parts.join("/");
}

export function findFileByPath(
    targetPath: string,
    files: readonly WorkspaceFile[],
    folders: readonly WorkspaceFolder[],
): WorkspaceFile | undefined {
    const normalized = targetPath.replace(/^\/+/, "");
    return files.find((file) => getRelativeFilePath(file, folders) === normalized);
}

export function findFolderByPath(
    targetPath: string,
    folders: readonly WorkspaceFolder[],
): WorkspaceFolder | undefined {
    const normalized = targetPath.replace(/^\/+/, "");
    return folders.find((folder) => getRelativeFolderPath(folder, folders) === normalized);
}

export function ensureFolderHierarchy(
    folderPath: string,
    workspace: Workspace,
): string | null {
    const normalized = folderPath.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!normalized) {
        return null;
    }

    const segments = normalized.split("/").filter(Boolean);
    let currentParentId: string | null = null;

    for (const segment of segments) {
        const currentFolders = workspace.getFolders();
        const existing = currentFolders.find(
            (f) => f.name === segment && f.parentId === currentParentId,
        );

        if (existing) {
            currentParentId = existing.id;
        } else {
            const result = workspace.createFolder(segment, { parentId: currentParentId });
            if (result.success && result.folder) {
                currentParentId = result.folder.id;
            }
        }
    }

    return currentParentId;
}
