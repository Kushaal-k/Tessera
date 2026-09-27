import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Trash2,
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
  readonly onRequestCreate?: (type: "file" | "folder", parentId: string | null) => void;
  readonly onConfirmCreate?: (name: string, type: "file" | "folder", parentId: string | null) => void;
  readonly onCancelCreate?: () => void;
  readonly onDeleteItem?: (id: string, type: "file" | "folder") => void;
}

function InlineCreationInput({
  type,
  depth,
  siblingNames,
  onConfirm,
  onCancel,
}: {
  readonly type: "file" | "folder";
  readonly depth: number;
  readonly siblingNames: readonly string[];
  readonly onConfirm: (name: string) => void;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCommittedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();

    const handlePointerDownOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!hasCommittedRef.current) {
          onCancel();
        }
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [onCancel]);

  const trimmed = name.trim();
  const isDuplicate =
    trimmed.length > 0 &&
    siblingNames.some((sibling) => sibling.toLowerCase() === trimmed.toLowerCase());

  const handleCommit = () => {
    if (isDuplicate) return;
    if (trimmed) {
      hasCommittedRef.current = true;
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    if (hasCommittedRef.current) return;
    onCancel();
  };

  return (
    <div
      ref={containerRef}
      style={{ paddingLeft: `${depth * 14}px` }}
      className="relative flex flex-col my-0.5"
    >
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded-md border transition-colors ${
          isDuplicate
            ? "border-rose-500 bg-rose-950/20"
            : "border-tessera-500 bg-slate-900"
        }`}
      >
        {type === "folder" ? (
          <Folder className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        ) : (
          <FileCode className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={type === "folder" ? "folder name" : "file.ts"}
          className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none font-mono"
        />
      </div>

      {isDuplicate && (
        <div className="mt-1 mb-1 p-1.5 bg-rose-950 border border-rose-800/80 rounded text-[10px] text-rose-200 leading-tight font-sans select-none">
          A {type === "file" ? "file" : "folder"} named '{trimmed}' already exists.
        </div>
      )}
    </div>
  );
}

export function FileTree({
  tree,
  activeFileId,
  onSelectFile,
  className = "",
  creatingItem,
  onRequestCreate,
  onConfirmCreate,
  onCancelCreate,
  onDeleteItem,
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
    if (node.type === "folder") {
      const isExpanded = expandedFolderIds.has(node.id);
      const isCreatingInside = creatingItem && creatingItem.parentId === node.id;

      return (
        <li key={node.id} role="treeitem" aria-expanded={isExpanded} className="group select-none">
          <div className="group/row flex items-center justify-between rounded-md py-1 pr-1 hover:bg-slate-800/60 transition-colors">
            <button
              type="button"
              onClick={() => toggleFolder(node.id)}
              onKeyDown={(e) => handleFolderKeyDown(e, node.id, isExpanded)}
              style={{ paddingLeft: `${depth * 14 + 4}px` }}
              className="flex flex-1 items-center gap-2 py-0.5 text-xs font-mono font-medium text-slate-300 hover:text-white outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-tessera-500/50"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              ) : (
                <Folder className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              )}
              <span className="truncate">{node.name}</span>
            </button>

            <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 transition-opacity">
              <button
                type="button"
                title="New File"
                aria-label={`New file in ${node.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestCreate?.("file", node.id);
                }}
                className="rounded p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
              >
                <FilePlus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="New Folder"
                aria-label={`New folder in ${node.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestCreate?.("folder", node.id);
                }}
                className="rounded p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Delete Folder"
                aria-label={`Delete ${node.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteItem?.(node.id, "folder");
                }}
                className="rounded p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="relative">
              <div
                style={{ left: `${depth * 14 + 10}px` }}
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-slate-800/80 group-hover:bg-slate-600 transition-colors"
                aria-hidden="true"
              />
              <ul role="group" className="space-y-0.5">
                {isCreatingInside && (
                  <li className="mb-0.5">
                    <InlineCreationInput
                      type={creatingItem.type}
                      depth={depth + 1}
                      siblingNames={node.children.map((child) => child.name)}
                      onConfirm={(name) =>
                        onConfirmCreate?.(name, creatingItem.type, node.id)
                      }
                      onCancel={() => onCancelCreate?.()}
                    />
                  </li>
                )}
                {node.children.map((child) => renderNode(child, depth + 1))}
              </ul>
            </div>
          )}
        </li>
      );
    }

    const isActive = node.id === activeFileId;

    return (
      <li key={node.id} role="treeitem" aria-selected={isActive} className="group/row select-none">
        <div
          className={`flex items-center justify-between rounded-md py-1 pr-1 transition-colors ${
            isActive
              ? "bg-slate-800 text-white shadow-sm font-semibold"
              : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
          }`}
        >
          <button
            type="button"
            onClick={() => onSelectFile?.(node)}
            onKeyDown={(e) => handleFileKeyDown(e, node)}
            style={{ paddingLeft: `${depth * 14 + (depth > 0 ? 14 : 4)}px` }}
            className="flex flex-1 items-center gap-2 py-0.5 text-xs font-mono font-medium outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-tessera-500/50 truncate"
          >
            <FileCode className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{node.name}</span>
          </button>

          <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 transition-opacity">
            <button
              type="button"
              title="Delete File"
              aria-label={`Delete ${node.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteItem?.(node.id, "file");
              }}
              className="rounded p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
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
    <nav aria-label="File Explorer" className={`overflow-y-auto pb-2 ${className}`}>
      <ul role="tree" className="space-y-0.5 pb-1">
        {isCreatingAtRoot && (
          <li className="mb-0.5">
            <InlineCreationInput
              type={creatingItem.type}
              depth={0}
              siblingNames={tree.map((node) => node.name)}
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