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
  Edit2,
} from "lucide-react";
import type {
  WorkspaceNode,
  WorkspaceFileNode,
} from "@tessera/shared-types";
import { FileIcon } from "../utils/fileIcons.js";

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
  readonly onRenameItem?: (id: string, newName: string, type: "file" | "folder") => void;
  readonly onMoveItem?: (id: string, targetParentId: string | null, type: "file" | "folder") => void;
}

function ActionBtn({
  title,
  ariaLabel,
  onClick,
  hoverColor = "hover:text-zinc-100 hover:bg-zinc-800",
  children,
}: {
  title: string;
  ariaLabel: string;
  onClick: (e: React.MouseEvent) => void;
  hoverColor?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={`rounded p-1 text-zinc-400 ${hoverColor} transition-colors`}
    >
      {children}
    </button>
  );
}

function RenameInput({
  initialName,
  isFolder,
  onCommit,
  onCancel,
}: {
  initialName: string;
  isFolder?: boolean;
  onCommit: (val: string) => void;
  onCancel: () => void;
}) {
  return (
    <input
      defaultValue={initialName}
      autoFocus
      ref={(el) => {
        if (el) {
          const dot = initialName.lastIndexOf(".");
          const selectEnd = !isFolder && dot > 0 ? dot : initialName.length;
          el.setSelectionRange(0, selectEnd);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onBlur={(e) => {
        const val = e.target.value.trim();
        if (val && val !== initialName) {
          onCommit(val);
        } else {
          onCancel();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          onCancel();
        }
      }}
      className="w-full bg-zinc-900 border border-zinc-500 rounded px-1.5 py-0.5 text-xs text-white font-mono outline-none shadow-inner"
    />
  );
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
  const committedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!committedRef.current) {
          onCancel();
        }
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [onCancel]);

  const trimmed = name.trim();
  const isDuplicate =
    trimmed.length > 0 &&
    siblingNames.some((s) => s.toLowerCase() === trimmed.toLowerCase());

  const commit = () => {
    if (isDuplicate) {
      return;
    }
    if (trimmed) {
      committedRef.current = true;
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ paddingLeft: `${depth * 14}px` }}
      className="relative flex flex-col my-1"
    >
      <div
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border shadow-xs transition-all ${
          isDuplicate
            ? "border-rose-500 bg-rose-950/30 ring-1 ring-rose-500/30"
            : "border-zinc-700 bg-zinc-900 ring-1 ring-zinc-700/50"
        }`}
      >
        {type === "folder" ? (
          <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        ) : (
          <FileCode className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          onBlur={() => {
            if (!committedRef.current) {
              onCancel();
            }
          }}
          placeholder={type === "folder" ? "folder name" : "index.ts"}
          className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-500 outline-none font-mono"
        />
        <div className="flex items-center gap-1 shrink-0 text-[9px] text-zinc-400 select-none">
          <kbd className="rounded bg-zinc-800 px-1 py-0.5 border border-zinc-700/60 font-mono">↵</kbd>
          <kbd className="rounded bg-zinc-800 px-1 py-0.5 border border-zinc-700/60 font-mono">esc</kbd>
        </div>
      </div>
      {isDuplicate && (
        <div className="mt-1 p-1.5 bg-rose-950/80 border border-rose-800/80 rounded-md text-[10px] text-rose-200 leading-tight font-sans select-none">
          A {type === "file" ? "file" : "folder"} named '{trimmed}' already exists.
        </div>
      )}
    </div>
  );
}

interface DragItemPayload {
  readonly id: string;
  readonly type: "file" | "folder";
  readonly parentId: string | null;
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
  onRenameItem,
  onMoveItem,
}: FileTreeProps) {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    const collect = (nodes: readonly WorkspaceNode[]) => {
      for (const node of nodes) {
        if (node.type === "folder") {
          ids.add(node.id);
          collect(node.children);
        }
      }
    };
    collect(tree);
    return ids;
  });

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDragStart = (e: React.DragEvent, node: WorkspaceNode) => {
    e.stopPropagation();
    const payload: DragItemPayload = {
      id: node.id,
      type: node.type,
      parentId: node.parentId,
    };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    setDraggedItemId(node.id);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverFolderId(null);
    setIsDragOverRoot(false);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverFolderId !== folderId && draggedItemId !== folderId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent, folderId: string) => {
    e.stopPropagation();
    if (dragOverFolderId === folderId) {
      setDragOverFolderId(null);
    }
  };

  const handleFolderDrop = (e: React.DragEvent, folder: WorkspaceNode) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    setDraggedItemId(null);
    setIsDragOverRoot(false);

    const raw = e.dataTransfer.getData("application/json");
    if (!raw) {
      return;
    }

    try {
      const data: DragItemPayload = JSON.parse(raw);
      if (data.id !== folder.id && data.parentId !== folder.id) {
        onMoveItem?.(data.id, folder.id, data.type);
        setExpandedFolderIds((prev) => new Set([...prev, folder.id]));
      }
    } catch {
      // Ignore malformed drag payload
    }
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isDragOverRoot) {
      setIsDragOverRoot(true);
    }
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDragOverRoot(false);
    }
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverRoot(false);
    setDragOverFolderId(null);
    setDraggedItemId(null);

    const raw = e.dataTransfer.getData("application/json");
    if (!raw) {
      return;
    }

    try {
      const data: DragItemPayload = JSON.parse(raw);
      if (data.parentId !== null) {
        onMoveItem?.(data.id, null, data.type);
      }
    } catch {
      // Ignore malformed drag payload
    }
  };

  const renderNode = (node: WorkspaceNode, depth: number) => {
    const isBeingDragged = draggedItemId === node.id;

    if (node.type === "folder") {
      const isExpanded =
        expandedFolderIds.has(node.id) || creatingItem?.parentId === node.id;
      const isCreatingInside = creatingItem?.parentId === node.id;
      const isTargetHovered = dragOverFolderId === node.id && draggedItemId !== node.id;

      return (
        <li
          key={node.id}
          role="treeitem"
          aria-expanded={isExpanded}
          draggable={renamingId !== node.id}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleFolderDragOver(e, node.id)}
          onDragLeave={(e) => handleFolderDragLeave(e, node.id)}
          onDrop={(e) => handleFolderDrop(e, node)}
          className={`group select-none ${isBeingDragged ? "opacity-40" : ""}`}
        >
          <div
            className={`group/row flex items-center justify-between rounded-md py-1 pr-1 transition-colors ${
              isTargetHovered
                ? "bg-zinc-800 ring-1 ring-zinc-500"
                : "hover:bg-zinc-900/80"
            }`}
          >
            <button
              type="button"
              onClick={() => toggleFolder(node.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" && !isExpanded) {
                  e.preventDefault();
                  toggleFolder(node.id);
                } else if (e.key === "ArrowLeft" && isExpanded) {
                  e.preventDefault();
                  toggleFolder(node.id);
                } else if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleFolder(node.id);
                } else if (e.key === "F2") {
                  e.preventDefault();
                  setRenamingId(node.id);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenamingId(node.id);
              }}
              style={{ paddingLeft: `${depth * 14 + 4}px` }}
              className="flex flex-1 items-center gap-2 py-0.5 text-xs font-mono font-medium text-zinc-300 hover:text-white outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 cursor-grab active:cursor-grabbing"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 shrink-0 text-zinc-500" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0 text-zinc-500" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              ) : (
                <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400/90" />
              )}
              {renamingId === node.id ? (
                <RenameInput
                  initialName={node.name}
                  isFolder
                  onCommit={(newName) => {
                    onRenameItem?.(node.id, newName, "folder");
                    setRenamingId(null);
                  }}
                  onCancel={() => {
                    setRenamingId(null);
                  }}
                />
              ) : (
                <span className="truncate">{node.name}</span>
              )}
            </button>

            <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 transition-opacity pr-1">
              <ActionBtn
                title="New File"
                ariaLabel={`New file in ${node.name}`}
                onClick={() => {
                  setExpandedFolderIds((prev) => new Set([...prev, node.id]));
                  onRequestCreate?.("file", node.id);
                }}
              >
                <FilePlus className="h-3.5 w-3.5" />
              </ActionBtn>
              <ActionBtn
                title="New Folder"
                ariaLabel={`New folder in ${node.name}`}
                onClick={() => {
                  setExpandedFolderIds((prev) => new Set([...prev, node.id]));
                  onRequestCreate?.("folder", node.id);
                }}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </ActionBtn>
              <ActionBtn
                title="Rename Folder"
                ariaLabel={`Rename ${node.name}`}
                hoverColor="hover:text-zinc-200 hover:bg-zinc-800"
                onClick={() => setRenamingId(node.id)}
              >
                <Edit2 className="h-3 w-3" />
              </ActionBtn>
              <ActionBtn
                title="Delete Folder"
                ariaLabel={`Delete ${node.name}`}
                hoverColor="hover:text-rose-400 hover:bg-rose-950/40"
                onClick={() => onDeleteItem?.(node.id, "folder")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </ActionBtn>
            </div>
          </div>

          {isExpanded && (
            <div className="relative">
              <div
                style={{ left: `${depth * 14 + 10}px` }}
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-zinc-800/80 group-hover:bg-zinc-700 transition-colors"
                aria-hidden="true"
              />
              <ul role="group" className="space-y-0.5">
                {isCreatingInside && (
                  <li className="mb-0.5">
                    <InlineCreationInput
                      type={creatingItem.type}
                      depth={depth + 1}
                      siblingNames={node.children.map((c) => c.name)}
                      onConfirm={(name) => {
                        onConfirmCreate?.(name, creatingItem.type, node.id);
                      }}
                      onCancel={() => {
                        onCancelCreate?.();
                      }}
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
      <li
        key={node.id}
        role="treeitem"
        aria-selected={isActive}
        draggable={renamingId !== node.id}
        onDragStart={(e) => handleDragStart(e, node)}
        onDragEnd={handleDragEnd}
        className={`group/row select-none ${isBeingDragged ? "opacity-40" : ""}`}
      >
        <div
          className={`flex items-center justify-between rounded-md py-1 pr-1 transition-colors ${
            isActive
              ? "bg-zinc-800/80 text-zinc-100 font-medium shadow-xs"
              : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
          }`}
        >
          <button
            type="button"
            onClick={() => onSelectFile?.(node)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectFile?.(node);
              } else if (e.key === "F2") {
                e.preventDefault();
                setRenamingId(node.id);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenamingId(node.id);
            }}
            style={{ paddingLeft: `${depth * 14 + (depth > 0 ? 14 : 4)}px` }}
            className="flex flex-1 items-center gap-2 py-0.5 text-xs font-mono font-medium outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 truncate cursor-grab active:cursor-grabbing"
          >
            <FileIcon filename={node.name} className="h-3.5 w-3.5 shrink-0" />
            {renamingId === node.id ? (
              <RenameInput
                initialName={node.name}
                onCommit={(newName) => {
                  onRenameItem?.(node.id, newName, "file");
                  setRenamingId(null);
                }}
                onCancel={() => {
                  setRenamingId(null);
                }}
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </button>

          <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 transition-opacity pr-1">
            <ActionBtn
              title="Rename File"
              ariaLabel={`Rename ${node.name}`}
              hoverColor="hover:text-zinc-200 hover:bg-zinc-800"
              onClick={() => setRenamingId(node.id)}
            >
              <Edit2 className="h-3 w-3" />
            </ActionBtn>
            <ActionBtn
              title="Delete File"
              ariaLabel={`Delete ${node.name}`}
              hoverColor="hover:text-rose-400 hover:bg-rose-950/40"
              onClick={() => onDeleteItem?.(node.id, "file")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </ActionBtn>
          </div>
        </div>
      </li>
    );
  };

  const isCreatingAtRoot = creatingItem && creatingItem.parentId === null;

  if (tree.length === 0 && !isCreatingAtRoot) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-zinc-500">
        <p className="mb-2.5">No files in workspace</p>
        <button
          type="button"
          onClick={() => onRequestCreate?.("file", null)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors border border-zinc-800 shadow-xs"
        >
          <FilePlus className="h-3.5 w-3.5" />
          Create File
        </button>
      </div>
    );
  }

  return (
    <nav
      aria-label="File Explorer"
      onDragOver={handleRootDragOver}
      onDragLeave={handleRootDragLeave}
      onDrop={handleRootDrop}
      className={`overflow-y-auto pb-2 min-h-full transition-colors ${
        isDragOverRoot ? "ring-1 ring-inset ring-zinc-600 bg-zinc-900/40" : ""
      } ${className}`}
    >
      <ul role="tree" className="space-y-0.5 pb-1">
        {isCreatingAtRoot && (
          <li className="mb-0.5">
            <InlineCreationInput
              type={creatingItem.type}
              depth={0}
              siblingNames={tree.map((node) => node.name)}
              onConfirm={(name) => {
                onConfirmCreate?.(name, creatingItem.type, null);
              }}
              onCancel={() => {
                onCancelCreate?.();
              }}
            />
          </li>
        )}
        {tree.map((node) => renderNode(node, 0))}
      </ul>
    </nav>
  );
}