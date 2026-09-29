import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createAwareness } from "@tessera/collaboration";
import type { editor, Uri } from "monaco-editor";

vi.mock("y-monaco", () => {
  return {
    MonacoBinding: class MockMonacoBinding {
      ytext: Y.Text;
      monacoModel: editor.ITextModel;
      editors: Set<editor.IStandaloneCodeEditor>;
      awareness: unknown;
      destroy = vi.fn();

      constructor(
        ytext: Y.Text,
        monacoModel: editor.ITextModel,
        editors: Set<editor.IStandaloneCodeEditor>,
        awareness: unknown,
      ) {
        this.ytext = ytext;
        this.monacoModel = monacoModel;
        this.editors = editors;
        this.awareness = awareness;
      }
    },
  };
});

import { MonacoModelManager } from "./monacoModelManager.js";

interface MockModel {
  uri: Uri;
  getValue: () => string;
  setValue: (val: string) => void;
  getLanguageId: () => string;
  isDisposed: () => boolean;
  dispose: () => void;
  onDidChangeContent: () => { dispose: () => void };
  onWillDispose: () => { dispose: () => void };
  getPositionAt: () => { lineNumber: number; column: number };
  getOffsetAt: () => number;
  applyEdits: () => void;
}

function createMockMonaco() {
  const models = new Map<string, MockModel>();
  return {
    Uri: {
      parse: (str: string): Uri =>
        ({
          toString: () => str,
          path: str,
        }) as unknown as Uri,
    },
    editor: {
      createModel: vi.fn((content: string, language: string, uri: Uri): MockModel => {
        let disposed = false;
        const currentLang = language;
        let currentVal = content;
        const model: MockModel = {
          uri,
          getValue: vi.fn(() => currentVal),
          setValue: vi.fn((val: string) => {
            currentVal = val;
          }),
          getLanguageId: vi.fn(() => currentLang),
          isDisposed: vi.fn(() => disposed),
          dispose: vi.fn(() => {
            disposed = true;
            models.delete(uri.toString());
          }),
          onDidChangeContent: vi.fn(() => ({ dispose: vi.fn() })),
          onWillDispose: vi.fn(() => ({ dispose: vi.fn() })),
          getPositionAt: vi.fn(() => ({ lineNumber: 1, column: 1 })),
          getOffsetAt: vi.fn(() => 0),
          applyEdits: vi.fn(),
        };
        models.set(uri.toString(), model);
        return model;
      }),
      getModel: vi.fn((uri: Uri): MockModel | undefined => models.get(uri.toString())),
      setModelLanguage: vi.fn((model: MockModel, lang: string) => {
        model.getLanguageId = vi.fn(() => lang);
      }),
    },
  };
}

function createMockEditor(initialModel: MockModel | null = null) {
  let currentModel = initialModel;
  return {
    getModel: vi.fn(() => currentModel),
    setModel: vi.fn((model: MockModel) => {
      currentModel = model;
    }),
    onDidChangeCursorSelection: vi.fn(() => ({
      dispose: vi.fn(),
    })),
    getSelection: vi.fn(() => null),
    deltaDecorations: vi.fn(() => []),
  };
}

describe("MonacoModelManager — dynamic model caching and rebinding", () => {
  it("creates a new Monaco ITextModel and sets it on the editor on initial bind", () => {
    const manager = new MonacoModelManager();
    const monaco = createMockMonaco();
    const editor = createMockEditor();
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("file-1");
    ytext.insert(0, "const x = 1;");
    const awareness = createAwareness(ydoc);

    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-1",
      fileName: "index.ts",
      ytext,
      awareness,
      language: "typescript",
    });

    expect(manager.getCachedModelCount()).toBe(1);
    expect(monaco.editor.createModel).toHaveBeenCalledTimes(1);
    expect(editor.setModel).toHaveBeenCalledTimes(1);
    expect(manager.getActiveBinding()).not.toBeNull();
    expect(manager.getActiveFileId()).toBe("file-1");

    manager.destroy();
    ydoc.destroy();
  });

  it("reuses existing cached model without creating a duplicate when switching back", () => {
    const manager = new MonacoModelManager();
    const monaco = createMockMonaco();
    const editor = createMockEditor();
    const ydoc = new Y.Doc();
    const ytext1 = ydoc.getText("file-1");
    const ytext2 = ydoc.getText("file-2");
    const awareness = createAwareness(ydoc);

    // Bind File 1
    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-1",
      fileName: "file1.ts",
      ytext: ytext1,
      awareness,
      language: "typescript",
    });

    const model1 = manager.getModel("file-1");
    expect(model1).toBeDefined();

    // Bind File 2
    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-2",
      fileName: "file2.py",
      ytext: ytext2,
      awareness,
      language: "python",
    });

    expect(manager.getCachedModelCount()).toBe(2);
    expect(monaco.editor.createModel).toHaveBeenCalledTimes(2);

    // Switch back to File 1
    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-1",
      fileName: "file1.ts",
      ytext: ytext1,
      awareness,
      language: "typescript",
    });

    expect(manager.getCachedModelCount()).toBe(2);
    expect(monaco.editor.createModel).toHaveBeenCalledTimes(2);
    expect(manager.getModel("file-1")).toBe(model1);
    expect(editor.setModel).toHaveBeenLastCalledWith(model1);

    manager.destroy();
    ydoc.destroy();
  });

  it("cleanly unbinds previous binding and clears awareness selection when switching files", () => {
    const manager = new MonacoModelManager();
    const monaco = createMockMonaco();
    const editor = createMockEditor();
    const ydoc = new Y.Doc();
    const ytext1 = ydoc.getText("file-1");
    const ytext2 = ydoc.getText("file-2");
    const awareness = createAwareness(ydoc);

    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-1",
      fileName: "file1.ts",
      ytext: ytext1,
      awareness,
    });

    const firstBinding = manager.getActiveBinding();
    const destroySpy = vi.spyOn(firstBinding!, "destroy");

    // Switch to file 2
    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-2",
      fileName: "file2.ts",
      ytext: ytext2,
      awareness,
    });

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(awareness.getLocalState()?.["selection"]).toBeNull();
    expect(manager.getActiveBinding()).not.toBe(firstBinding);

    manager.destroy();
    ydoc.destroy();
  });

  it("updates model language if language differs from cached model", () => {
    const manager = new MonacoModelManager();
    const monaco = createMockMonaco();
    const editor = createMockEditor();
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("file-1");
    const awareness = createAwareness(ydoc);

    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-1",
      fileName: "script",
      ytext,
      awareness,
      language: "python",
    });

    const model = manager.getModel("file-1");
    expect(model?.getLanguageId()).toBe("python");

    // Change language to rust
    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-1",
      fileName: "script",
      ytext,
      awareness,
      language: "rust",
    });

    expect(monaco.editor.setModelLanguage).toHaveBeenCalledWith(model, "rust");

    manager.destroy();
    ydoc.destroy();
  });

  it("prunes cached models that are no longer in open tabs", () => {
    const manager = new MonacoModelManager();
    const monaco = createMockMonaco();
    const editor = createMockEditor();
    const ydoc = new Y.Doc();
    const ytext1 = ydoc.getText("file-1");
    const ytext2 = ydoc.getText("file-2");
    const awareness = createAwareness(ydoc);

    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-1",
      fileName: "file1.ts",
      ytext: ytext1,
      awareness,
      openFileIds: ["file-1", "file-2"],
    });

    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-2",
      fileName: "file2.ts",
      ytext: ytext2,
      awareness,
      openFileIds: ["file-1", "file-2"],
    });

    const model1 = manager.getModel("file-1");
    expect(manager.getCachedModelCount()).toBe(2);

    // Close tab file-1
    manager.pruneModels(["file-2"]);

    expect(model1?.dispose).toHaveBeenCalledTimes(1);
    expect(manager.getModel("file-1")).toBeUndefined();
    expect(manager.getCachedModelCount()).toBe(1);

    manager.destroy();
    ydoc.destroy();
  });

  it("disposes and recreates model when file is renamed", () => {
    const manager = new MonacoModelManager();
    const monaco = createMockMonaco();
    const editor = createMockEditor();
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("file-1");
    const awareness = createAwareness(ydoc);

    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-1",
      fileName: "oldName.ts",
      ytext,
      awareness,
    });

    const oldModel = manager.getModel("file-1");
    expect(oldModel).toBeDefined();

    // Renamed to newName.ts
    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-1",
      fileName: "newName.ts",
      ytext,
      awareness,
    });

    expect(oldModel?.dispose).toHaveBeenCalledTimes(1);
    const newModel = manager.getModel("file-1");
    expect(newModel).toBeDefined();
    expect(newModel).not.toBe(oldModel);

    manager.destroy();
    ydoc.destroy();
  });

  it("disposes all models and tears down binding on destroy", () => {
    const manager = new MonacoModelManager();
    const monaco = createMockMonaco();
    const editor = createMockEditor();
    const ydoc = new Y.Doc();
    const ytext1 = ydoc.getText("file-1");
    const ytext2 = ydoc.getText("file-2");
    const awareness = createAwareness(ydoc);

    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-1",
      fileName: "file1.ts",
      ytext: ytext1,
      awareness,
    });
    manager.bindModel({
      editor: editor as unknown as editor.IStandaloneCodeEditor,
      monaco: monaco as unknown as typeof import("monaco-editor"),
      fileId: "file-2",
      fileName: "file2.ts",
      ytext: ytext2,
      awareness,
    });

    const model1 = manager.getModel("file-1");
    const model2 = manager.getModel("file-2");
    const activeBinding = manager.getActiveBinding();
    const destroySpy = vi.spyOn(activeBinding!, "destroy");

    manager.destroy();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(model1?.dispose).toHaveBeenCalledTimes(1);
    expect(model2?.dispose).toHaveBeenCalledTimes(1);
    expect(manager.getCachedModelCount()).toBe(0);
    expect(manager.getActiveBinding()).toBeNull();

    ydoc.destroy();
  });
});
