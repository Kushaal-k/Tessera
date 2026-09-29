import { MonacoBinding } from "y-monaco";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import type { editor, IDisposable } from "monaco-editor";
import type { SupportedLanguage } from "@tessera/shared-types";

const LANGUAGE_MAP: Record<SupportedLanguage, string> = {
  typescript: "typescript",
  python: "python",
  cpp: "cpp",
  java: "java",
  rust: "rust",
  go: "go",
};

export function getMonacoLanguage(language?: SupportedLanguage | string): string {
  if (!language) {
    return "plaintext";
  }
  if (language in LANGUAGE_MAP) {
    return LANGUAGE_MAP[language as SupportedLanguage];
  }
  return language;
}

export interface BindModelOptions {
  readonly editor: editor.IStandaloneCodeEditor;
  readonly monaco: typeof import("monaco-editor");
  readonly fileId?: string;
  readonly fileName?: string;
  readonly ytext: Y.Text;
  readonly awareness: Awareness;
  readonly language?: SupportedLanguage | string;
  readonly openFileIds?: readonly string[];
}

export class MonacoModelManager {
  private readonly models = new Map<string, editor.ITextModel>();
  private activeBinding: MonacoBinding | null = null;
  private cursorListenerDisposable: IDisposable | null = null;
  private activeFileId: string | null = null;

  public getModel(fileId: string): editor.ITextModel | undefined {
    return this.models.get(fileId);
  }

  public getActiveBinding(): MonacoBinding | null {
    return this.activeBinding;
  }

  public getActiveFileId(): string | null {
    return this.activeFileId;
  }

  public getCachedModelCount(): number {
    return this.models.size;
  }

  public bindModel(options: BindModelOptions): void {
    const {
      editor,
      monaco,
      fileId,
      fileName,
      ytext,
      awareness,
      language,
      openFileIds,
    } = options;

    const currentFileId = fileId ?? "default";
    const monacoLang = getMonacoLanguage(language);
    const fileUri = monaco.Uri.parse(
      `inmemory://workspace/${currentFileId}/${fileName ?? "file"}`,
    );

    // Clean up previous binding before attaching a new one
    this.unbindCurrent();

    // Clear remote selection in awareness on switch to prevent lingering cursor rendering
    awareness.setLocalStateField("selection", null);

    // Get or create the cached ITextModel
    let model = this.models.get(currentFileId);

    // If filename or extension changed, dispose the outdated URI model
    if (model && !model.isDisposed()) {
      if (model.uri.toString() !== fileUri.toString()) {
        model.dispose();
        model = undefined;
      }
    }

    if (!model || model.isDisposed()) {
      const existing = monaco.editor.getModel(fileUri);
      if (existing && !existing.isDisposed()) {
        model = existing;
      } else {
        model = monaco.editor.createModel(ytext.toString(), monacoLang, fileUri);
      }
      this.models.set(currentFileId, model);
    }

    if (model.getLanguageId() !== monacoLang) {
      monaco.editor.setModelLanguage(model, monacoLang);
    }

    // Set the model on the editor if it differs
    const previousModel = editor.getModel();
    if (previousModel !== model) {
      editor.setModel(model);
      if (
        previousModel &&
        !previousModel.isDisposed() &&
        previousModel.uri.toString().startsWith("inmemory://model/")
      ) {
        previousModel.dispose();
      }
    }

    // Intercept onDidChangeCursorSelection to capture and dispose the listener registered by y-monaco
    const editorWithMutableEvents = editor as unknown as {
      onDidChangeCursorSelection: (
        listener: (e: editor.ICursorSelectionChangedEvent) => void,
      ) => IDisposable;
    };
    const originalOnDidChangeCursorSelection =
      editorWithMutableEvents.onDidChangeCursorSelection.bind(editor);
    let capturedDisposable: IDisposable | null = null;
    editorWithMutableEvents.onDidChangeCursorSelection = (listener) => {
      const disposable = originalOnDidChangeCursorSelection(listener);
      capturedDisposable = disposable;
      return disposable;
    };

    const binding = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      awareness,
    );

    editorWithMutableEvents.onDidChangeCursorSelection = originalOnDidChangeCursorSelection;

    this.activeBinding = binding;
    this.cursorListenerDisposable = capturedDisposable;
    this.activeFileId = currentFileId;

    // Prune cached models that are no longer open
    if (openFileIds && openFileIds.length > 0) {
      this.pruneModels(openFileIds);
    }
  }

  public unbindCurrent(): void {
    if (this.activeBinding) {
      this.activeBinding.destroy();
      this.activeBinding = null;
    }
    if (this.cursorListenerDisposable) {
      this.cursorListenerDisposable.dispose();
      this.cursorListenerDisposable = null;
    }
    this.activeFileId = null;
  }

  public pruneModels(openFileIds: readonly string[]): void {
    const openSet = new Set(openFileIds);
    for (const [id, cachedModel] of this.models.entries()) {
      if (!openSet.has(id)) {
        if (!cachedModel.isDisposed()) {
          cachedModel.dispose();
        }
        this.models.delete(id);
      }
    }
  }

  public destroy(): void {
    this.unbindCurrent();
    for (const cachedModel of this.models.values()) {
      if (!cachedModel.isDisposed()) {
        cachedModel.dispose();
      }
    }
    this.models.clear();
  }
}
