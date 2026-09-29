import { useMemo, useState, useEffect, useCallback } from "react";
import { SidePanel, ConfirmModal } from "@tessera/ui-components";
import { CollaborativeEditor } from "./components/CollaborativeEditor.js";
import {
  useCollaboration,
  createDefaultParticipant,
} from "./hooks/useCollaboration.js";
import { setLocalParticipant } from "@tessera/collaboration";
import type {
  SyncConnectionConfig,
  WorkspaceFile,
} from "@tessera/shared-types";
import { useDebouncedValue } from "./hooks/useDebouncedValue.js";
import { downloadTextFile } from "./utils/downloadUtils.js";
import { collectDescendantFolderIds } from "./utils/workspaceUtils.js";
import { FileTree, type CreatingItemState } from "./components/FileTree.js";
import { useWorkspace } from "./hooks/useWorkspace.js";
import { useTabManager } from "./hooks/useTabManager.js";
import { useCodeExecution } from "./hooks/useCodeExecution.js";
import { HeaderToolbar } from "./components/HeaderToolbar.js";
import { OutputPanel } from "./components/OutputPanel.js";
import { EditorSettings } from "./components/EditorSettings.js";
import { TabBar } from "./components/TabBar.js";
import { FilePlus, FolderPlus, Loader2, FileCode } from "lucide-react";

const SYNC_SERVER_URL = "http://localhost:4000";
const DEFAULT_ROOM = "default-room";

export function App() {
  const participant = useMemo(() => createDefaultParticipant(), []);
  const [displayName, setDisplayName] = useState(participant.displayName);
  const debouncedName = useDebouncedValue(displayName, 250);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
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
  const {
    activeFileId,
    openFileIds,
    openFiles,
    language,
    setActiveFileId,
    handleSelectFile,
    handleCloseTab,
    openFile,
    removeFilesFromTabs,
  } = useTabManager({ files });

  const activeYText = useMemo(() => {
    if (!workspace || !activeFileId) {
      return ytext;
    }
    return workspace.getFileText(activeFileId);
  }, [workspace, activeFileId, ytext]);

  const { isRunning, output, handleRunCode } = useCodeExecution({
    socket,
    activeYText,
    language,
  });

  useEffect(() => {
    if (!awareness) {
      return;
    }
    setLocalParticipant(awareness, {
      ...participant,
      displayName: debouncedName.trim() || "Anonymous",
    });
  }, [awareness, participant, debouncedName]);

  const handleConfirmCreate = useCallback(
    (name: string, type: "file" | "folder", parentId: string | null) => {
      if (!workspace) {
        return;
      }
      if (type === "file") {
        const res = workspace.createFile(name, { parentId });
        if (res.success && res.file) {
          openFile(res.file);
        }
      } else {
        workspace.createFolder(name, { parentId });
      }
      setCreatingItem(null);
    },
    [workspace, openFile],
  );

  const performFolderDeletion = useCallback(
    (folderId: string) => {
      if (!workspace) {
        return;
      }

      const descendantFolderIds = collectDescendantFolderIds(folderId, folders);
      const deletedFileIds = new Set(
        files
          .filter((f) => f.parentId && descendantFolderIds.has(f.parentId))
          .map((f) => f.id),
      );

      workspace.deleteFolder(folderId);
      removeFilesFromTabs(deletedFileIds);
    },
    [workspace, folders, files, removeFilesFromTabs],
  );

  const handleDeleteItem = useCallback(
    (id: string, type: "file" | "folder") => {
      if (!workspace) {
        return;
      }
      if (type === "file") {
        workspace.deleteFile(id);
        handleCloseTab(id);
      } else {
        const folder = workspace.getFolder(id);
        if (!folder) {
          return;
        }

        const descendantFolderIds = collectDescendantFolderIds(id, folders);
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
    [workspace, handleCloseTab, files, folders, performFolderDeletion],
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

  const handleMoveItem = useCallback(
    (id: string, targetParentId: string | null, type: "file" | "folder") => {
      if (!workspace) {
        return;
      }

      const result =
        type === "folder"
          ? workspace.moveFolder(id, targetParentId)
          : workspace.moveFile(id, targetParentId);

      if (!result.success) {
        console.warn("Failed to move item:", result.error);
      }
    },
    [workspace],
  );

  const handleDownload = useCallback(() => {
    if (!activeYText) {
      return;
    }
    const activeFile = files.find((f) => f.id === activeFileId);
    downloadTextFile(activeYText.toString(), activeFile?.name ?? "untitled.txt");
  }, [activeYText, files, activeFileId]);

  const activeFileName = useMemo(() => {
    const activeFile = files.find((f: WorkspaceFile) => f.id === activeFileId);
    return activeFile?.name ?? null;
  }, [files, activeFileId]);

  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg)]">
      <HeaderToolbar
        language={language}
        onLanguageChange={() => {
          // Language is now derived from the active file; manual override is display-only
        }}
        connected={connected}
        isRunning={isRunning}
        onRunCode={handleRunCode}
        onDownload={handleDownload}
        canDownload={activeYText !== null}
        onOpenAiPanel={() => setIsAiPanelOpen(true)}
        activeFileName={activeFileName}
      />

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
              onMoveItem={handleMoveItem}
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

          <EditorSettings
            showMinimap={showMinimap}
            onShowMinimapChange={setShowMinimap}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
          />
        </aside>

        {/* Editor */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <TabBar
            openFiles={openFiles}
            activeFileId={activeFileId}
            onSelectTab={setActiveFileId}
            onCloseTab={handleCloseTab}
          />

          <div className="flex-1 overflow-hidden relative">
            {activeFileId && activeYText && awareness ? (
              <CollaborativeEditor
                fileId={activeFileId}
                fileName={activeFileName ?? undefined}
                ytext={activeYText}
                awareness={awareness}
                language={language}
                showMinimap={showMinimap}
                fontSize={fontSize}
                openFileIds={openFileIds}
              />
            ) : openFiles.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500 font-medium bg-[var(--color-bg)]">
                <FileCode className="h-10 w-10 text-slate-600 mb-1" />
                <p className="text-sm">No files open</p>
                <p className="text-xs text-slate-600">Select a file from the explorer to open it</p>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500 font-medium bg-[var(--color-bg)]">
                <Loader2 className="animate-spin h-8 w-8 text-tessera-400" />
                Connecting to collaboration server…
              </div>
            )}
          </div>
        </main>
      </div>

      <OutputPanel isRunning={isRunning} output={output} />

      <SidePanel
        open={isAiPanelOpen}
        title="AI Chat"
        description={`Context: ${activeFileName ?? "No file selected"}`}
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
