import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  WorkspaceFile,
  WorkspaceFileNode,
  SupportedLanguage,
} from "@tessera/shared-types";

export interface UseTabManagerOptions {
  readonly files: readonly WorkspaceFile[];
}

export interface UseTabManagerReturn {
  readonly activeFileId: string | null;
  readonly openFileIds: readonly string[];
  readonly openFiles: readonly WorkspaceFile[];
  readonly language: SupportedLanguage;
  readonly setActiveFileId: (id: string | null) => void;
  readonly handleSelectFile: (file: WorkspaceFileNode) => void;
  readonly handleCloseTab: (fileId: string) => void;
  readonly openFile: (file: WorkspaceFile) => void;
  readonly removeFilesFromTabs: (fileIds: Set<string>) => void;
}

const DEFAULT_LANGUAGE: SupportedLanguage = "typescript";

export function useTabManager({ files }: UseTabManagerOptions): UseTabManagerReturn {
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);

  const openFiles = useMemo(() => {
    return openFileIds
      .map((id) => files.find((f) => f.id === id))
      .filter((f): f is WorkspaceFile => f !== undefined);
  }, [openFileIds, files]);

  // Derive language from the active file instead of managing it as separate state
  const language = useMemo<SupportedLanguage>(() => {
    const activeFile = files.find((f) => f.id === activeFileId);
    return (activeFile?.language as SupportedLanguage) ?? DEFAULT_LANGUAGE;
  }, [files, activeFileId]);

  // Auto-select the first file if the active file no longer exists
  useEffect(() => {
    if (files.length > 0 && (!activeFileId || !files.some((f) => f.id === activeFileId))) {
      const first = files[0];
      if (first) {
        setActiveFileId(first.id);
        setOpenFileIds((prev) => (prev.includes(first.id) ? prev : [first.id, ...prev]));
      }
    }
  }, [files, activeFileId]);

  const handleSelectFile = useCallback((file: WorkspaceFileNode) => {
    setActiveFileId(file.id);
    setOpenFileIds((prev) => (prev.includes(file.id) ? prev : [...prev, file.id]));
  }, []);

  const handleCloseTab = useCallback(
    (fileIdToClose: string) => {
      setOpenFileIds((prev) => {
        const index = prev.indexOf(fileIdToClose);
        if (index === -1) {
          return prev;
        }
        const nextOpen = prev.filter((id) => id !== fileIdToClose);

        if (activeFileId === fileIdToClose) {
          if (nextOpen.length === 0) {
            setActiveFileId(null);
          } else {
            const nextActiveIndex = index >= nextOpen.length ? nextOpen.length - 1 : index;
            const nextActiveId = nextOpen[nextActiveIndex];
            if (nextActiveId !== undefined) {
              setActiveFileId(nextActiveId);
            }
          }
        }

        return nextOpen;
      });
    },
    [activeFileId],
  );

  const openFile = useCallback((file: WorkspaceFile) => {
    setActiveFileId(file.id);
    setOpenFileIds((prev) => (prev.includes(file.id) ? prev : [...prev, file.id]));
  }, []);

  const removeFilesFromTabs = useCallback(
    (deletedFileIds: Set<string>) => {
      setOpenFileIds((prev) => {
        const nextOpen = prev.filter((id) => !deletedFileIds.has(id));
        if (activeFileId && deletedFileIds.has(activeFileId)) {
          if (nextOpen.length === 0) {
            setActiveFileId(null);
          } else {
            const nextActiveId = nextOpen[0];
            if (nextActiveId !== undefined) {
              setActiveFileId(nextActiveId);
            }
          }
        }
        return nextOpen;
      });
    },
    [activeFileId],
  );

  return {
    activeFileId,
    openFileIds,
    openFiles,
    language,
    setActiveFileId,
    handleSelectFile,
    handleCloseTab,
    openFile,
    removeFilesFromTabs,
  };
}
