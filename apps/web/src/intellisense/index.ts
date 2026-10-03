import type * as Monaco from "monaco-editor";
import { registerCppIntelliSense } from "./cpp.js";
import { registerPythonIntelliSense } from "./python.js";
import { registerJavaIntelliSense } from "./java.js";
import { registerRustIntelliSense } from "./rust.js";

const registeredLanguages = new Set<string>();

//ensured that rust is also added as the return command may prevent addition of rust
export function registerEditorIntelliSense(monaco: typeof Monaco) {
  if (!registeredLanguages.has("cpp")) {
    registerCppIntelliSense(monaco);
    registeredLanguages.add("cpp");
  }
  if (!registeredLanguages.has("python")) {
    registerPythonIntelliSense(monaco);
    registeredLanguages.add("python");
  }
  if (!registeredLanguages.has("java")) {
    registerJavaIntelliSense(monaco);
    registeredLanguages.add("java");
  }
  if (!registeredLanguages.has("rust")) {
    registerRustIntelliSense(monaco);
    registeredLanguages.add("rust");
  }
}
