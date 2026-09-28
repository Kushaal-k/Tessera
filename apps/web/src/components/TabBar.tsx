import { useCallback, type MouseEvent } from "react";
import { X, FileCode } from "lucide-react";
import type { WorkspaceFile } from "@tessera/shared-types";

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
            className="flex h-9 w-full items-center overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] text-xs select-none no-scrollbar"
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
                        className={`group relative flex h-full items-center gap-2 border-r border-[var(--color-border)] px-3 cursor-pointer transition-colors 
                            ${isActive ? "bg-[var(--color-bg)] text-white font-medium border-t-2 border-t-tessera-500"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border-t-2 border-t-transparent"}
                        `}
                    >
                        <FileCode className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-300" />
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button
                            type="button"
                            aria-label={`Close ${file.name}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onCloseTab(file.id);
                            }}
                            className="ml-1 rounded p-0.5 text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-slate-700 hover:text-slate-200 transition-all focus:opacity-100"
                        >
                        <X className="h-3 w-3" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}