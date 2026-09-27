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
  readonly onRenameItem?: (id: string, newName: string, type: "file" | "folder") => void;
}

function ActionBtn({
  title,
  ariaLabel,
  onClick,
  hoverColor = "hover:text-amber-400 hover:bg-amber-400/10",
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
      className={`rounded p-1 text-slate-400 ${hoverColor} transition-colors`}
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
      className="w-full bg-slate-900 border border-tessera-500 rounded px-1.5 py-0.5 text-xs text-white font-mono outline-none shadow-inner"
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
      className="relative flex flex-col my-0.5"
    >
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded-md border ${
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
  onRenameItem,
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

  useEffect(() => {
    if (creatingItem?.parentId) {
      setExpandedFolderIds((prev) => new Set([...prev, creatingItem.parentId!]));
    }
  }, [creatingItem]);

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

  const renderNode = (node: WorkspaceNode, depth: number) => {
    if (node.type === "folder") {
      const isExpanded = expandedFolderIds.has(node.id);
      const isCreatingInside = creatingItem?.parentId === node.id;

      return (
        <li key={node.id} role="treeitem" aria-expanded={isExpanded} className="group select-none">
          <div className="group/row flex items-center justify-between rounded-md py-1 pr-1 hover:bg-slate-800/60 transition-colors">
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
              className="flex flex-1 items-center gap-2 py-0.5 text-xs font-mono font-medium text-slate-300 hover:text-white outline-none focus-visible:ring-1 focus-visible:ring-tessera-500/50"
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

            <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 transition-opacity">
              <ActionBtn
                title="New File"
                ariaLabel={`New file in ${node.name}`}
                onClick={() => onRequestCreate?.("file", node.id)}
              >
                <FilePlus className="h-3.5 w-3.5" />
              </ActionBtn>
              <ActionBtn
                title="New Folder"
                ariaLabel={`New folder in ${node.name}`}
                onClick={() => onRequestCreate?.("folder", node.id)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
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
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-slate-800/80 group-hover:bg-slate-600 transition-colors"
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
            className="flex flex-1 items-center gap-2 py-0.5 text-xs font-mono font-medium outline-none focus-visible:ring-1 focus-visible:ring-tessera-500/50 truncate"
          >
            <FileCode className="h-3.5 w-3.5 shrink-0 text-slate-400" />
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

          <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 transition-opacity">
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
    return <div className="px-3 py-4 text-center text-xs text-slate-500">No files in workspace</div>;
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