import { useState, useEffect, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import type * as Y from "yjs";
import type {
  ExecutionResult,
  SupportedLanguage,
  WorkspaceFile,
  WorkspaceFolder,
  ExecutionFile,
} from "@tessera/shared-types";
import type { Workspace } from "@tessera/collaboration";
import { isMacOS } from "../utils/platformDetection.js";
import { getRelativeFilePath } from "../utils/workspaceUtils.js";

export interface UseCodeExecutionOptions {
  readonly socket: Socket | null;
  readonly activeYText: Y.Text | null;
  readonly language: SupportedLanguage;
  readonly workspace?: Workspace | null;
  readonly files?: readonly WorkspaceFile[];
  readonly folders?: readonly WorkspaceFolder[];
  readonly activeFileId?: string | null;
}

export interface UseCodeExecutionReturn {
  readonly isRunning: boolean;
  readonly output: ExecutionResult | null;
  readonly handleRunCode: () => void;
}

export function useCodeExecution({
  socket,
  activeYText,
  language,
  workspace,
  files,
  folders,
  activeFileId,
}: UseCodeExecutionOptions): UseCodeExecutionReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<ExecutionResult | null>(null);

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

  const handleRunCode = useCallback(() => {
    if (!socket || isRunning) {
      return;
    }

    setIsRunning(true);
    setOutput(null);

    if (workspace && files && folders && activeFileId) {
      const activeFile = files.find((f) => f.id === activeFileId);
      const executionFiles: ExecutionFile[] = files.map((file) => ({
        path: getRelativeFilePath(file, folders),
        content: workspace.getFileText(file.id).toString(),
      }));
      const entrypoint = activeFile
        ? getRelativeFilePath(activeFile, folders)
        : undefined;

      socket.emit("execute-code", {
        files: executionFiles,
        entrypoint,
        code: activeYText ? activeYText.toString() : undefined,
        language,
      });
    } else if (activeYText) {
      socket.emit("execute-code", {
        code: activeYText.toString(),
        language,
      });
    } else {
      setIsRunning(false);
    }
  }, [socket, activeYText, isRunning, language, workspace, files, folders, activeFileId]);

  // Stable ref so the keydown listener always calls the latest handler
  const runCodeRef = useRef(handleRunCode);
  useEffect(() => {
    runCodeRef.current = handleRunCode;
  }, [handleRunCode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isExec = isMacOS() ? e.metaKey : e.ctrlKey;
      if (isExec && e.key === "Enter") {
        e.preventDefault();
        runCodeRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return { isRunning, output, handleRunCode };
}
