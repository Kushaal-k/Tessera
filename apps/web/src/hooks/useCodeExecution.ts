import { useState, useEffect, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import type * as Y from "yjs";
import type { ExecutionResult, SupportedLanguage } from "@tessera/shared-types";
import { isMacOS } from "../utils/platformDetection.js";

export interface UseCodeExecutionOptions {
  readonly socket: Socket | null;
  readonly activeYText: Y.Text | null;
  readonly language: SupportedLanguage;
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
    if (!socket || !activeYText || isRunning) {
      return;
    }
    setIsRunning(true);
    setOutput(null);
    socket.emit("execute-code", { code: activeYText.toString(), language });
  }, [socket, activeYText, isRunning, language]);

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
