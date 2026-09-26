import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ChevronRight,
  FileCode,
  Folder,
  FolderOpen,
} from "lucide-react";
import type {
  WorkspaceNode,
  WorkspaceFileNode,
} from "@tessera/shared-types";

export interface CreatingItemState {
  readonly type: "file" | "folder";
  readonly parentId: string | null;
}

export interface FileTreeProps {
  readonly tree: readonly WorkspaceNode[];
  readonly activeFileId?: string | null;
  readonly onSelectFile?: (file: WorkspaceFileNode) => void;
  readonly className?: string;
  readonly creatingItem?: CreatingItemState | null;
  readonly onConfirmCreate?: (name: string, type: "file" | "folder", parentId: string | null) => void;
  readonly onCancelCreate?: () => void;
}

function InlineCreationInput({
  type,
  depth,
  onConfirm,
  onCancel,
}: {
  readonly type: "file" | "folder";
  readonly depth: number;
  readonly onConfirm: (name: string) => void;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = name.trim();
      if (trimmed) {
        onConfirm(trimmed);
      } else {
        onCancel();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const paddingLeft = `${depth * 14 + 8}px`;

  return (
    <div style={{ paddingLeft }} className="flex items-center gap-1.5 py-0.5 pr-2">
      {type === "folder" ? (
        <Folder className="h-4 w-4 shrink-0 text-amber-400/90" />
      ) : (
        <>
          <span className="w-3 shrink-0" />
          <FileCode className="h-4 w-4 shrink-0 text-slate-400" />
        </>
      )}
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed) {
            onConfirm(trimmed);
          } else {
            onCancel();
          }
        }}
        placeholder={type === "folder" ? "folder name" : "file.ts"}
        className="w-full rounded border border-tessera-500 bg-slate-900 px-1.5 py-0.5 text-xs text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-tessera-500"
      />
    </div>
  );
}

export function FileTree({
  tree,
  activeFileId,
  onSelectFile,
  className = "",
  creatingItem,
  onConfirmCreate,
  onCancelCreate,
}: FileTreeProps) {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    const collectFolderIds = (nodes: readonly WorkspaceNode[]) => {
      for (const node of nodes) {
        if (node.type === "folder") {
          ids.add(node.id);
          collectFolderIds(node.children);
        }
      }
    };

    collectFolderIds(tree);
    return ids;
  });

  // Auto-expand folder if a file/folder is being created inside it
  useEffect(() => {
    if (creatingItem?.parentId) {
      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        next.add(creatingItem.parentId!);
        return next;
      });
    }
  }, [creatingItem]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleFolderKeyDown = (
    e: React.KeyboardEvent,
    folderId: string,
    isExpanded: boolean,
  ) => {
    e.preventDefault();
    if (e.key === "ArrowRight" && !isExpanded) {
      toggleFolder(folderId);
    } else if (e.key === "ArrowLeft" && isExpanded) {
      toggleFolder(folderId);
    } else if (e.key === "Enter" || e.key === " ") {
      toggleFolder(folderId);
    }
  };

  const handleFileKeyDown = (
    e: React.KeyboardEvent,
    file: WorkspaceFileNode,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectFile?.(file);
    }
  };

  const renderNode = (node: WorkspaceNode, depth: number) => {
    const paddingLeft = `${depth * 14 + 8}px`;

    if (node.type === "folder") {
      const isExpanded = expandedFolderIds.has(node.id);
      const isCreatingInside = creatingItem && creatingItem.parentId === node.id;

      return (
        <li key={node.id} role="treeitem" aria-expanded={isExpanded} className="select-none">
          <button
            type="button"
            onClick={() => toggleFolder(node.id)}
            onKeyDown={(e) => handleFolderKeyDown(e, node.id, isExpanded)}
            style={{ paddingLeft }}
            className="flex w-full items-center gap-1.5 rounded py-1 pr-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-tessera-500/50"
          >
            <ChevronRight
              className={`h-3 w-3 shrink-0 text-slate-400 transition-transform duration-150 ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-amber-400/90" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-amber-400/90" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {isExpanded && (
            <ul role="group" className="space-y-0.5">
              {isCreatingInside && (
                <li>
                  <InlineCreationInput
                    type={creatingItem.type}
                    depth={depth + 1}
                    onConfirm={(name) =>
                      onConfirmCreate?.(name, creatingItem.type, node.id)
                    }
                    onCancel={() => onCancelCreate?.()}
                  />
                </li>
              )}
              {node.children.map((child) => renderNode(child, depth + 1))}
            </ul>
          )}
        </li>
      );
    }

    const isActive = node.id === activeFileId;

    return (
      <li key={node.id} role="treeitem" aria-selected={isActive} className="select-none">
        <button
          type="button"
          onClick={() => onSelectFile?.(node)}
          onKeyDown={(e) => handleFileKeyDown(e, node)}
          style={{ paddingLeft }}
          className={`flex w-full items-center gap-2 rounded py-1 pr-2 text-xs font-medium transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-tessera-500/50 ${
            isActive
              ? "bg-tessera-500/15 text-tessera-400 font-semibold"
              : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
          }`}
        >
          <span className="w-3 shrink-0" />
          <FileCode className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate">{node.name}</span>
        </button>
      </li>
    );
  };

  const isCreatingAtRoot = creatingItem && creatingItem.parentId === null;

  if (tree.length === 0 && !isCreatingAtRoot) {
    return (
      <div className="px-3 py-4 text-center text-xs text-slate-500">
        No files in workspace
      </div>
    );
  }

  return (
    <nav aria-label="File Explorer" className={`overflow-y-auto ${className}`}>
      <ul role="tree" className="space-y-0.5">
        {isCreatingAtRoot && (
          <li>
            <InlineCreationInput
              type={creatingItem.type}
              depth={0}
              onConfirm={(name) =>
                onConfirmCreate?.(name, creatingItem.type, null)
              }
              onCancel={() => onCancelCreate?.()}
            />
          </li>
        )}
        {tree.map((node) => renderNode(node, 0))}
      </ul>
    </nav>
  );
}