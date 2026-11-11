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
import { useAwarenessPeers } from "./hooks/useAwarenessPeers.js";
import { downloadTextFile } from "./utils/downloadUtils.js";
import { collectDescendantFolderIds } from "./utils/workspaceUtils.js";
import { getExecutionShortcutText } from "./utils/platformDetection.js";
import { getSavedDisplayName, saveDisplayName } from "./utils/userProfile.js";
import { FileTree, type CreatingItemState } from "./components/FileTree.js";
import { useWorkspace } from "./hooks/useWorkspace.js";
import { useTabManager } from "./hooks/useTabManager.js";
import { useCodeExecution } from "./hooks/useCodeExecution.js";
import { HeaderToolbar } from "./components/HeaderToolbar.js";
import { BottomPanel, type BottomPanelTab } from "./components/BottomPanel.js";
import { ResizableLayout } from "./components/ResizableLayout.js";
import { EditorSettings } from "./components/EditorSettings.js";
import { TabBar } from "./components/TabBar.js";
import { AiAssistantPanel } from "./components/AiAssistantPanel.js";
import { useAuth } from "./auth/index.js";
import {
  FilePlus,
  FolderPlus,
  Loader2,
  Code2,
  Bot,
  Keyboard,
  Plus,
} from "lucide-react";

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const SYNC_SERVER_URL =
  import.meta.env.VITE_SYNC_SERVER_URL ??
  (typeof window !== "undefined" && !isLocalhost
    ? window.location.origin
    : "http://localhost:4000");
const DEFAULT_ROOM = "default-room";

export function App() {
  const { user, logout } = useAuth();
  const savedName = useMemo(() => getSavedDisplayName(), []);
  const authName = user?.name?.trim() || user?.nickname?.trim();
  const effectiveInitialName = authName || savedName || "Anonymous";

  const participant = useMemo(
    () => createDefaultParticipant({ displayName: effectiveInitialName }),
    [effectiveInitialName],
  );
  const [displayName, setDisplayName] = useState(effectiveInitialName);
  const debouncedName = useDebouncedValue(displayName, 250);

  useEffect(() => {
    if (!savedName && authName) {
      saveDisplayName(authName);
    }
  }, [authName, savedName]);

  const handleDisplayNameChange = useCallback((name: string) => {
    setDisplayName(name);
    saveDisplayName(name);
  }, []);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomPanelTab>("terminal");
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
  const peers = useAwarenessPeers(awareness);
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
    workspace,
    files,
    folders,
    activeFileId,
  });

  useEffect(() => {
    if (!awareness) {
      return;
    }
    const effectiveName = debouncedName.trim() || "Anonymous";
    setLocalParticipant(awareness, {
      ...participant,
      displayName: effectiveName,
    });
    if (debouncedName.trim()) {
      saveDisplayName(debouncedName);
    }
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

  const handleRunCodeClick = useCallback(() => {
    setBottomPanelTab("output");
    handleRunCode();
  }, [handleRunCode]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isExec = (e.metaKey || e.ctrlKey) && e.key === "Enter";
      if (isExec) {
        e.preventDefault();
        handleRunCodeClick();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [handleRunCodeClick]);

  return (
    <div className="flex h-screen flex-col bg-black text-zinc-100">
      <HeaderToolbar
        localParticipant={participant}
        peers={peers}
        displayName={displayName}
        onDisplayNameChange={handleDisplayNameChange}
        connected={connected}
        isRunning={isRunning}
        onRunCode={handleRunCodeClick}
        onDownload={handleDownload}
        canDownload={activeYText !== null}
        onOpenAiPanel={() => setIsAiPanelOpen(true)}
        activeFileName={activeFileName}
        authUser={user}
        onLogout={logout}
      />

      <ResizableLayout
        sidebar={
          <aside className="w-full h-full border-r border-white/[0.08] bg-[#09090b] p-3 flex flex-col gap-3 select-none">
            {/* Explorer Section */}
            <div className="flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-zinc-400">
                    Explorer
                  </span>
                  <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 border border-white/[0.08]">
                    {files.length}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    title="New File"
                    aria-label="New File"
                    onClick={() => {
                      setCreatingItem({ type: "file", parentId: null });
                    }}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                  >
                    <FilePlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="New Folder"
                    aria-label="New Folder"
                    onClick={() => {
                      setCreatingItem({ type: "folder", parentId: null });
                    }}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <FileTree
                  tree={tree}
                  activeFileId={activeFileId}
                  onSelectFile={handleSelectFile}
                  creatingItem={creatingItem}
                  onRequestCreate={(type, parentId) => {
                    setCreatingItem({ type, parentId });
                  }}
                  onConfirmCreate={handleConfirmCreate}
                  onCancelCreate={() => {
                    setCreatingItem(null);
                  }}
                  onDeleteItem={handleDeleteItem}
                  onRenameItem={handleRenameItem}
                  onMoveItem={handleMoveItem}
                />
              </div>
            </div>

            <EditorSettings
              showMinimap={showMinimap}
              onShowMinimapChange={setShowMinimap}
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
              defaultExpanded={false}
            />
          </aside>
        }
        editor={
          <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#09090b]">
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
                  onRunCode={handleRunCodeClick}
                />
              ) : openFiles.length === 0 ? (
                <div className="flex h-full w-full flex-col items-center justify-center bg-[#09090b] p-6 text-center select-none overflow-y-auto">
                  <div className="relative mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 border border-white/[0.08] text-zinc-200">
                      <Code2 className="h-6 w-6 text-zinc-300" />
                    </div>
                  </div>

                  <h2 className="text-sm font-medium tracking-tight text-white mb-1.5">
                    Welcome to Tessera Sandbox
                  </h2>
                  <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
                    Collaborative developer sandbox with real-time CRDT sync, Monaco editor, and containerized Docker runtime.
                  </p>

                  <div className="flex items-center gap-2 mb-8">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingItem({ type: "file", parentId: null });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3.5 py-1.5 text-xs font-medium text-zinc-950 hover:bg-white transition-colors duration-150 cursor-pointer border border-white/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create file
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAiPanelOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900/80 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-white/[0.16] transition-colors duration-150 cursor-pointer"
                    >
                      <Bot className="h-3.5 w-3.5 text-zinc-400" />
                      AI assistant
                    </button>
                  </div>

                  {/* Quick Shortcuts Card */}
                  <div className="w-full max-w-md rounded-lg border border-white/[0.08] bg-zinc-900/40 p-3.5 text-left text-xs">
                    <div className="flex items-center gap-1.5 mb-2.5 text-zinc-400 font-medium text-xs">
                      <Keyboard className="h-3.5 w-3.5 text-zinc-500" />
                      Keyboard shortcuts
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-zinc-300 text-[11px]">
                      <div className="flex items-center justify-between p-2 rounded-md bg-black/40 border border-white/[0.06]">
                        <span className="text-zinc-400">Run code</span>
                        <kbd className="font-mono text-[10px] text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/[0.08]">
                          {getExecutionShortcutText()}
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-md bg-black/40 border border-white/[0.06]">
                        <span className="text-zinc-400">Rename item</span>
                        <kbd className="font-mono text-[10px] text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/[0.08]">
                          F2
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-md bg-black/40 border border-white/[0.06]">
                        <span className="text-zinc-400">Close tab</span>
                        <span className="font-mono text-[10px] text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/[0.08]">
                          Middle click
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-md bg-black/40 border border-white/[0.06]">
                        <span className="text-zinc-400">Reset splitter</span>
                        <span className="font-mono text-[10px] text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/[0.08]">
                          Double click
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#09090b] text-zinc-400">
                  <Loader2 className="animate-spin h-7 w-7 text-zinc-400" />
                  <p className="text-xs font-medium text-zinc-300">Synchronizing workspace CRDTs…</p>
                </div>
              )}
            </div>
          </main>
        }
        bottomPanel={
          <BottomPanel
            isRunning={isRunning}
            output={output}
            roomId={DEFAULT_ROOM}
            activeTab={bottomPanelTab}
            onTabChange={setBottomPanelTab}
          />
        }
      />

      <SidePanel
        open={isAiPanelOpen}
        title="AI Assistant"
        description={`Context: ${activeFileName ?? "No active file selected"}`}
        onClose={() => setIsAiPanelOpen(false)}
      >
        <AiAssistantPanel
          activeFileName={activeFileName}
          activeCode={activeYText?.toString()}
          language={language}
        />
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
