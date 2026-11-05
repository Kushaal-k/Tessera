import { useCallback, type MouseEvent } from "react";
import { X } from "lucide-react";
import type { WorkspaceFile } from "@tessera/shared-types";
import { FileIcon } from "../utils/fileIcons.js";

export interface TabBarProps {
  readonly openFiles: readonly WorkspaceFile[];
  readonly activeFileId: string | null;
  readonly onSelectTab: (fileId: string) => void;
  readonly onCloseTab: (fileId: string) => void;
}

export function TabBar({
  openFiles,
  activeFileId,
  onSelectTab,
  onCloseTab,
}: TabBarProps) {
  const handleAuxClick = useCallback(
    (e: MouseEvent, fileId: string) => {
      if (e.button === 1) {
        e.preventDefault();
        onCloseTab(fileId);
      }
    },
    [onCloseTab],
  );

  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Open Files"
      className="flex h-9 w-full items-center overflow-x-auto border-b border-zinc-800/80 bg-black text-xs select-none no-scrollbar z-10"
    >
      {openFiles.map((file) => {
        const isActive = file.id === activeFileId;
        return (
          <div
            key={file.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            onClick={() => onSelectTab(file.id)}
            onAuxClick={(e) => handleAuxClick(e, file.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectTab(file.id);
              }
            }}
            className={`group relative flex h-full items-center gap-2 border-r border-zinc-800/80 px-3 cursor-pointer transition-colors ${
              isActive
                ? "bg-[#09090b] text-zinc-100 font-medium border-t-2 border-t-zinc-200 shadow-xs"
                : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200 border-t-2 border-t-transparent"
            }`}
          >
            <FileIcon filename={file.name} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[160px] font-mono text-[11px]">{file.name}</span>
            <button
              type="button"
              aria-label={`Close ${file.name}`}
              title="Close tab (Middle click)"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(file.id);
              }}
              className={`ml-1 rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-all focus:opacity-100 ${
                isActive ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}