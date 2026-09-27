import { useMemo, useState, useEffect, useCallback } from "react";
import { SidePanel, ConfirmModal } from "@tessera/ui-components";
import { CollaborativeEditor } from "./components/CollaborativeEditor.js";
import {
  useCollaboration,
  createDefaultParticipant,
} from "./hooks/useCollaboration.js";
import { isMacOS, getExecutionShortcutText } from "./utils/platformDetection.js";
import { setLocalParticipant } from "@tessera/collaboration";
import type {
  SyncConnectionConfig,
  SupportedLanguage,
  ExecutionResult,
  WorkspaceFileNode,
} from "@tessera/shared-types";
import { useDebouncedValue } from "./hooks/useDebouncedValue.js";
import { downloadTextFile } from "./utils/downloadUtils.js";
import { FileTree, type CreatingItemState } from "./components/FileTree.js";
import { useWorkspace } from "./hooks/useWorkspace.js";
import { FilePlus, FolderPlus, Download, Play, Loader2 } from "lucide-react";

const SYNC_SERVER_URL = "http://localhost:4000";
const DEFAULT_ROOM = "default-room";

const FILE_NAMES: Record<SupportedLanguage, string> = {
  typescript: "main.ts",
  python: "main.py",
  cpp: "main.cpp",
  java: "Main.java",
  rust: "main.rs",
  go: "main.go",
};

export function App() {
  const participant = useMemo(() => createDefaultParticipant(), []);
  const [displayName, setDisplayName] = useState(participant.displayName);
  const debouncedName = useDebouncedValue(displayName, 250);
  const [language, setLanguage] = useState<SupportedLanguage>("typescript");
  const [isRunning, setIsRunning] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState<CreatingItemState | null>(null);
  const [confirmDeleteState, setConfirmDeleteState] = useState<{
    id: string;
    name: string;
    fileCount: number;
    subFolderCount: number;
  } | null>(null);

  const config = useMemo<SyncConnectionConfig>(
    () => ({
      serverUrl: SYNC_SERVER_URL,
      roomId: DEFAULT_ROOM,
      participant,
    }),
    [participant],
  );

  const { ydoc, ytext, awareness, connected, socket } = useCollaboration(config);
  const { workspace, tree, files, folders } = useWorkspace(ydoc);

  const activeYText = useMemo(() => {
    if (!workspace || !activeFileId) {
      return ytext;
    }
    return workspace.getFileText(activeFileId);
  }, [workspace, activeFileId, ytext]);

  useEffect(() => {
    if (!awareness) {
      return;
    }
    setLocalParticipant(awareness, {
      ...participant,
      displayName: debouncedName.trim() || "Anonymous",
    });
  }, [awareness, participant, debouncedName]);

  useEffect(() => {
    if (!socket) {
      return;
    }
    const handleResult = (result: ExecutionResult) => {
      setOutput(result);
      setIsRunning(false);
    };
    socket.on("execution-result", handleResult);
    return () => {
      socket.off("execution-result", handleResult);
    };
  }, [socket]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isExec = isMacOS() ? e.metaKey : e.ctrlKey;
      if (isExec && e.key === "Enter") {
        e.preventDefault();
        if (!isRunning && connected) {
          handleRunCode();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [socket, activeYText, isRunning, connected, language]);

  useEffect(() => {
    if (files.length > 0 && (!activeFileId || !files.some((f) => f.id === activeFileId))) {
      const first = files[0];
      if (first) {
        setActiveFileId(first.id);
      }
    }
  }, [files, activeFileId]);

  const handleSelectFile = useCallback((file: WorkspaceFileNode) => {
    setActiveFileId(file.id);
    if (file.language) {
      setLanguage(file.language as SupportedLanguage);
    }
  }, []);

  const handleConfirmCreate = useCallback(
    (name: string, type: "file" | "folder", parentId: string | null) => {
      if (!workspace) {
        return;
      }
      if (type === "file") {
        const res = workspace.createFile(name, { parentId });
        if (res.success && res.file) {
          setActiveFileId(res.file.id);
          if (res.file.language) {
            setLanguage(res.file.language as SupportedLanguage);
          }
        }
      } else {
        workspace.createFolder(name, { parentId });
      }
      setCreatingItem(null);
    },
    [workspace],
  );

  const performFolderDeletion = useCallback(
    (folderId: string) => {
      if (!workspace) {
        return;
      }

      const descendantFolderIds = new Set<string>();
      const queue = [folderId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        descendantFolderIds.add(current);
        for (const folder of folders) {
          if (folder.parentId === current && !descendantFolderIds.has(folder.id)) {
            queue.push(folder.id);
          }
        }
      }

      const deletedFileIds = new Set(
        files
          .filter((f) => f.parentId && descendantFolderIds.has(f.parentId))
          .map((f) => f.id),
      );

      workspace.deleteFolder(folderId);

      if (activeFileId && deletedFileIds.has(activeFileId)) {
        const remaining = files.filter((f) => !deletedFileIds.has(f.id));
        setActiveFileId(remaining[0]?.id ?? null);
      }
    },
    [workspace, folders, files, activeFileId],
  );

  const handleDeleteItem = useCallback(
    (id: string, type: "file" | "folder") => {
      if (!workspace) {
        return;
      }
      if (type === "file") {
        workspace.deleteFile(id);
        if (activeFileId === id) {
          const remaining = files.filter((f) => f.id !== id);
          setActiveFileId(remaining[0]?.id ?? null);
        }
      } else {
        const folder = workspace.getFolder(id);
        if (!folder) {
          return;
        }

        const descendantFolderIds = new Set<string>();
        const queue = [id];
        while (queue.length > 0) {
          const current = queue.shift()!;
          descendantFolderIds.add(current);
          for (const f of folders) {
            if (f.parentId === current && !descendantFolderIds.has(f.id)) {
              queue.push(f.id);
            }
          }
        }

        const descendantFiles = files.filter(
          (f) => f.parentId && descendantFolderIds.has(f.parentId),
        );
        const subFolderCount = descendantFolderIds.size - 1;
        const fileCount = descendantFiles.length;

        if (fileCount > 0 || subFolderCount > 0) {
          setConfirmDeleteState({
            id,
            name: folder.name,
            fileCount,
            subFolderCount,
          });
        } else {
          performFolderDeletion(id);
        }
      }
    },
    [workspace, activeFileId, files, folders, performFolderDeletion],
  );

  const handleRenameItem = useCallback(
    (id: string, newName: string, type: "file" | "folder") => {
      if (!workspace) {
        return;
      }
      if (type === "file") {
        workspace.renameFile(id, newName);
      } else {
        workspace.renameFolder(id, newName);
      }
    },
    [workspace],
  );

  const handleRunCode = () => {
    if (!socket || !activeYText || isRunning) {
      return;
    }
    setIsRunning(true);
    setOutput(null);
    socket.emit("execute-code", { code: activeYText.toString(), language });
  };

  const handleDownload = () => {
    if (!activeYText) {
      return;
    }
    const activeFile = files.find((f) => f.id === activeFileId);
    downloadTextFile(activeYText.toString(), activeFile?.name || FILE_NAMES[language]);
  };

  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 bg-[var(--color-surface)]">
        <h1 className="text-lg font-semibold tracking-tight text-white">
          Tessera<span className="text-tessera-500">.io</span>
        </h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Language:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              className="bg-[var(--color-bg)] text-sm text-white border border-[var(--color-border)] rounded px-2 py-1 focus:outline-none focus:border-tessera-500 font-medium"
            >
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
              <option value="rust">Rust</option>
              <option value="go">Go</option>
            </select>
          </div>

          <button
            onClick={handleRunCode}
            disabled={!connected || isRunning}
            title={`Run code (${getExecutionShortcutText()})`}
            className={`flex items-center gap-1.5 px-3 py-1 text-sm font-semibold rounded transition shadow-sm ${
              isRunning
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : !connected
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-tessera-600 hover:bg-tessera-500 text-white cursor-pointer active:scale-95"
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="animate-spin h-3.5 w-3.5 text-slate-400" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-3 w-3 fill-current" />
                Run
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            disabled={!ytext}
            className="flex items-center justify-center p-1.5 text-slate-400 hover:text-white hover:bg-[var(--color-bg)] rounded transition"
            title={`Download ${FILE_NAMES[language]}`}
          >
            <Download className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsAiPanelOpen(true)}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-sm font-semibold text-slate-200 transition hover:border-tessera-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-tessera-500"
          >
            AI Panel
          </button>

          <div className="flex items-center gap-2 border-l border-[var(--color-border)] pl-4">
            <span
              className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`}
            />
            <span className="text-xs text-slate-400 font-medium">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex flex-col gap-4">
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Explorer
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  title="New File"
                  aria-label="New File"
                  onClick={() => setCreatingItem({ type: "file", parentId: null })}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                >
                  <FilePlus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="New Folder"
                  aria-label="New Folder"
                  onClick={() => setCreatingItem({ type: "folder", parentId: null })}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <FileTree
              tree={tree}
              activeFileId={activeFileId}
              onSelectFile={handleSelectFile}
              creatingItem={creatingItem}
              onRequestCreate={(type, parentId) => setCreatingItem({ type, parentId })}
              onConfirmCreate={handleConfirmCreate}
              onCancelCreate={() => setCreatingItem(null)}
              onDeleteItem={handleDeleteItem}
              onRenameItem={handleRenameItem}
            />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              You
            </p>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: participant.cursorColor }}
                aria-hidden="true"
              />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={32}
                placeholder="Display name"
                aria-label="Your display name"
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-tessera-500 outline-none"
              />
            </div>
          </div>

          <div className="mt-auto border-t border-[var(--color-border)] pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Editor Settings
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label htmlFor="minimap-toggle" className="text-xs font-medium text-slate-300 cursor-pointer select-none">
                  Show Minimap
                </label>
                <label htmlFor="minimap-toggle" className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="minimap-toggle"
                    checked={showMinimap}
                    onChange={(e) => setShowMinimap(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-tessera-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Font Size</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setFontSize((prev) => Math.max(10, prev - 1))}
                    disabled={fontSize <= 10}
                    className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-slate-300 hover:text-white disabled:opacity-40 select-none transition-all active:scale-95"
                  >
                    A-
                  </button>
                  <span className="text-xs font-mono font-medium text-slate-200 min-w-[28px] text-center">
                    {fontSize}px
                  </span>
                  <button
                    onClick={() => setFontSize((prev) => Math.min(24, prev + 1))}
                    disabled={fontSize >= 24}
                    className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-slate-300 hover:text-white disabled:opacity-40 select-none transition-all active:scale-95"
                  >
                    A+
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Editor */}
        <main className="flex-1 overflow-hidden">
          {activeYText && awareness ? (
            <CollaborativeEditor
              key={activeFileId ?? "default"}
              ytext={activeYText}
              awareness={awareness}
              language={language}
              showMinimap={showMinimap}
              fontSize={fontSize}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500 font-medium bg-[var(--color-bg)]">
              <Loader2 className="animate-spin h-8 w-8 text-tessera-400" />
              Connecting to collaboration server…
            </div>
          )}
        </main>
      </div>

      {/* Output panel */}
      <div className="h-56 shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col p-3 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Execution Output
          </p>
          {output && (
            <div className="flex gap-4 text-xs font-medium">
              <span className={output.status === "completed" ? "text-emerald-400" : "text-rose-400"}>
                Status: {output.status}
              </span>
              <span className="text-slate-400">Duration: {output.durationMs}ms</span>
              {output.exitCode !== null && (
                <span className={output.exitCode === 0 ? "text-emerald-400" : "text-rose-400"}>
                  Exit Code: {output.exitCode}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-xs p-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
          {isRunning ? (
            <span className="text-tessera-400 animate-pulse">Running execution sandbox...</span>
          ) : output ? (
            <div className="space-y-1 whitespace-pre-wrap">
              {output.stdout && <div className="text-emerald-300">{output.stdout}</div>}
              {output.stderr && <div className="text-rose-400 font-semibold">{output.stderr}</div>}
              {!output.stdout && !output.stderr && (
                <div className="text-slate-500 italic">
                  No output returned (Process completed with exit code {output.exitCode}).
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-500">Ready to execute. Write some code and click "Run".</span>
          )}
        </div>
      </div>

      <SidePanel
        open={isAiPanelOpen}
        title="AI Chat"
        description={`Context: ${FILE_NAMES[language]}`}
        onClose={() => setIsAiPanelOpen(false)}
      >
        <div className="rounded border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm text-slate-400">
          Ready for editor context.
        </div>
      </SidePanel>

      <ConfirmModal
        open={Boolean(confirmDeleteState)}
        title={`Delete '${confirmDeleteState?.name}'?`}
        description={
          confirmDeleteState
            ? `This folder contains ${confirmDeleteState.fileCount} file${confirmDeleteState.fileCount === 1 ? "" : "s"}${
                confirmDeleteState.subFolderCount > 0
                  ? ` and ${confirmDeleteState.subFolderCount} subfolder${confirmDeleteState.subFolderCount === 1 ? "" : "s"}`
                  : ""
              }. Are you sure you want to delete it and all of its contents?`
            : undefined
        }
        confirmLabel="Delete Folder"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (confirmDeleteState) {
            performFolderDeletion(confirmDeleteState.id);
            setConfirmDeleteState(null);
          }
        }}
        onCancel={() => {
          setConfirmDeleteState(null);
        }}
      />
    </div>
  );
}
