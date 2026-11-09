import { useRef, useEffect, useState, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import type { editor } from "monaco-editor";
import type { SupportedLanguage } from "@tessera/shared-types";
import { registerEditorIntelliSense } from "../intellisense/index.js";
import { useMonacoModelManager } from "../hooks/useMonacoModelManager.js";
import { useMonacoDecorations } from "../hooks/useMonacoDecorations.js";

export interface CollaborativeEditorProps {
  readonly fileId?: string;
  readonly fileName?: string;
  readonly ytext: Y.Text;
  readonly awareness: Awareness;
  readonly language?: SupportedLanguage | string;
  readonly showMinimap?: boolean;
  readonly fontSize?: number;
  readonly openFileIds?: readonly string[];
  readonly onRunCode?: () => void;
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
  onRunCode,
}: CollaborativeEditorProps) {
  const [editorState, setEditorState] = useState<{
    editor: editor.IStandaloneCodeEditor;
    monaco: typeof import("monaco-editor");
  } | null>(null);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const onRunCodeRef = useRef(onRunCode);

  useEffect(() => {
    onRunCodeRef.current = onRunCode;
  }, [onRunCode]);

  useMonacoDecorations(awareness);

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

    monaco.editor.defineTheme("tessera-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#09090b",
        "editor.foreground": "#f4f4f5",
        "editorCursor.foreground": "#ffffff",
        "editor.lineHighlightBackground": "#121214",
        "editorGutter.background": "#09090b",
        "editorLineNumber.foreground": "#52525b",
        "editorLineNumber.activeForeground": "#d4d4d8",
        "editorIndentGuide.background": "#1f1f23",
        "editorIndentGuide.activeBackground": "#3f3f46",
        "editor.selectionBackground": "#27272a",
        "editor.inactiveSelectionBackground": "#18181b",
        "editorWidget.background": "#09090b",
        "editorWidget.border": "#27272a",
        "editorSuggestWidget.background": "#09090b",
        "editorSuggestWidget.border": "#27272a",
        "editorSuggestWidget.foreground": "#e4e4e7",
        "editorSuggestWidget.selectedBackground": "#18181b",
        "editorSuggestWidget.highlightForeground": "#ffffff",
        "editorHoverWidget.background": "#09090b",
        "editorHoverWidget.border": "#27272a",
        "editorHoverWidget.foreground": "#e4e4e7",
        "peekView.border": "#27272a",
        "peekViewEditor.background": "#000000",
        "peekViewResult.background": "#09090b",
        "list.hoverBackground": "#18181b",
        "list.activeSelectionBackground": "#27272a",
        "list.activeSelectionForeground": "#ffffff",
        "input.background": "#000000",
        "input.border": "#27272a",
        "input.foreground": "#f4f4f5",
        "scrollbarSlider.background": "#27272a80",
        "scrollbarSlider.hoverBackground": "#3f3f4680",
        "scrollbarSlider.activeBackground": "#52525b80",
        "minimap.background": "#09090b",
      },
    });
    monaco.editor.setTheme("tessera-dark");

    mountedEditor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => {
        onRunCodeRef.current?.();
      },
    );

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
      theme="tessera-dark"
      onMount={handleEditorMount}
      options={{
        minimap: { enabled: showMinimap },
        fontSize,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontLigatures: true,
        lineHeight: Math.round(fontSize * 1.55),
        lineNumbers: "on",
        renderWhitespace: "selection",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 14, bottom: 14 },
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        smoothScrolling: true,
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        renderLineHighlight: "all",
        roundedSelection: true,
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
    />
  );
}
