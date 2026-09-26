import { useState, useEffect, useMemo } from "react";
import type {
    WorkspaceFile,
    WorkspaceFolder,
    WorkspaceNode,
    CreateWorkspaceOptions
} from "@tessera/shared-types";

import * as Y from "yjs";
import { createWorkspace, Workspace } from "@tessera/collaboration";

export interface UseWorkspaceOptions {
    readonly id?: string;
    readonly name?: string;
}

export interface UseWorkspaceReturn {
    readonly workspace: Workspace | null;
    readonly tree: readonly WorkspaceNode[];
    readonly files: readonly WorkspaceFile[];
    readonly folders: readonly WorkspaceFolder[];
}

const DEFAULT_WORKSPACE_OPTIONS: CreateWorkspaceOptions = {
    id: "default-workspace",
    name: "Workspace",
}

export function useWorkspace(
    ydoc: Y.Doc | null,
    options?: UseWorkspaceOptions,
): UseWorkspaceReturn {
    const workspace = useMemo(() => {
        if (!ydoc) return null;

        return createWorkspace(
            {
                id: options?.id ?? DEFAULT_WORKSPACE_OPTIONS.id,
                name: options?.name ?? DEFAULT_WORKSPACE_OPTIONS.name,
            },
            ydoc,
        );
    }, [ydoc, options?.id, options?.name]);

    const [tree, setTree] = useState<readonly WorkspaceNode[]>(() => 
        workspace ? workspace.buildWorkspaceTree() : []
    );

    const [files, setFiles] = useState<readonly WorkspaceFile[]>(() => 
        workspace ? workspace.getFiles() : []
    );

    const [folders, setFolders] = useState<readonly WorkspaceFolder[]>(() => 
        workspace ? workspace.getFolders() : []
    );

    useEffect(() => {
        if (!workspace) {
            setTree([]);
            setFiles([]);
            setFolders([]);
            return;
        }

        const updateState = () => {
            setFiles(workspace.getFiles());
            setFolders(workspace.getFolders());
            setTree(workspace.buildWorkspaceTree());
        };

        //Populate Initial State
        updateState();

        const unsubscribeFiles = workspace.onFilesChanged(updateState);
        const unsubscribeFolders = workspace.onFoldersChanged(updateState);

        return () => {
            unsubscribeFiles();
            unsubscribeFolders();
        }
    }, [workspace]);


    return {
        workspace,
        tree,
        files,
        folders,
    };
}