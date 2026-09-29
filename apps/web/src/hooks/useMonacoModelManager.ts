import { useEffect, useState } from "react";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import type { editor } from "monaco-editor";
import type { SupportedLanguage } from "@tessera/shared-types";
import { MonacoModelManager } from "../utils/monacoModelManager.js";

export interface UseMonacoModelManagerOptions {
  readonly editor: editor.IStandaloneCodeEditor | null;
  readonly monaco: typeof import("monaco-editor") | null;
  readonly fileId?: string;
  readonly fileName?: string;
  readonly ytext: Y.Text;
  readonly awareness: Awareness;
  readonly language?: SupportedLanguage | string;
  readonly openFileIds?: readonly string[];
}

export function useMonacoModelManager({
  editor,
  monaco,
  fileId,
  fileName,
  ytext,
  awareness,
  language,
  openFileIds,
}: UseMonacoModelManagerOptions): MonacoModelManager {
  const [manager] = useState(() => new MonacoModelManager());

  useEffect(() => {
    if (openFileIds) {
      manager.pruneModels(openFileIds);
    }
  }, [openFileIds, manager]);

  useEffect(() => {
    if (!editor || !monaco || !ytext) {
      return;
    }

    manager.bindModel({
      editor,
      monaco,
      fileId,
      fileName,
      ytext,
      awareness,
      language,
      openFileIds,
    });

    return () => {
      manager.unbindCurrent();
      if (awareness) {
        awareness.setLocalStateField("selection", null);
      }
    };
  }, [manager, editor, monaco, fileId, fileName, ytext, awareness, language, openFileIds]);

  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, [manager]);

  return manager;
}
