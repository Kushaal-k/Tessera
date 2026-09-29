import { useRef, useEffect, useState, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import type { editor } from "monaco-editor";
import type { SupportedLanguage } from "@tessera/shared-types";
import { registerEditorIntelliSense } from "../intellisense/index.js";
import { useMonacoModelManager } from "../hooks/useMonacoModelManager.js";

export interface CollaborativeEditorProps {
  readonly fileId?: string;
  readonly fileName?: string;
  readonly ytext: Y.Text;
  readonly awareness: Awareness;
  readonly language?: SupportedLanguage | string;
  readonly showMinimap?: boolean;
  readonly fontSize?: number;
  readonly openFileIds?: readonly string[];
}

export function CollaborativeEditor({
  fileId,
  fileName,
  ytext,
  awareness,
  language = "typescript",
  showMinimap = true,
  fontSize = 14,
  openFileIds,
}: CollaborativeEditorProps) {
  const [editorState, setEditorState] = useState<{
    editor: editor.IStandaloneCodeEditor;
    monaco: typeof import("monaco-editor");
  } | null>(null);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useMonacoModelManager({
    editor: editorState?.editor ?? null,
    monaco: editorState?.monaco ?? null,
    fileId,
    fileName,
    ytext,
    awareness,
    language,
    openFileIds,
  });

  const handleEditorMount: OnMount = useCallback((mountedEditor, monaco) => {
    editorRef.current = mountedEditor;
    registerEditorIntelliSense(monaco);
    setEditorState({ editor: mountedEditor, monaco });
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        minimap: { enabled: showMinimap },
      });
    }
  }, [showMinimap]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize });
    }
  }, [fontSize]);

  return (
    <Editor
      height="100%"
      theme="vs-dark"
      onMount={handleEditorMount}
      options={{
        minimap: { enabled: showMinimap },
        fontSize,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        lineNumbers: "on",
        renderWhitespace: "selection",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 16 },
        cursorBlinking: "smooth",
        smoothScrolling: true,
      }}
    />
  );
}
