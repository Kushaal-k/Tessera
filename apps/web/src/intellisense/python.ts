import type * as Monaco from "monaco-editor";
import { createRange } from "./utils.js";

const PYTHON_KEYWORDS = [
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
];

const BUILTIN_FUNCTIONS = [
  "abs",
  "all",
  "any",
  "enumerate",
  "filter",
  "input",
  "isinstance",
  "len",
  "map",
  "max",
  "min",
  "open",
  "print",
  "range",
  "sorted",
  "sum",
  "type",
  "zip",
];

const BUILTIN_TYPES = [
  "bool",
  "dict",
  "float",
  "int",
  "list",
  "set",
  "str",
  "tuple",
];

const EXCEPTIONS = [
  "Exception",
  "FileNotFoundError",
  "ImportError",
  "IndexError",
  "KeyError",
  "RuntimeError",
  "TypeError",
  "ValueError",
];

export function registerPythonIntelliSense(monaco: typeof Monaco): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("python", {
    provideCompletionItems(model, position) {
      const range = createRange(monaco, model, position);

      const keywordSuggestions = PYTHON_KEYWORDS.map((keyword) => ({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        range,
      }));

      const functionSuggestions = BUILTIN_FUNCTIONS.map((fn) => ({
        label: fn,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: `${fn}(\${1:})`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: "Built-in function",
        range,
      }));

      const typeSuggestions = BUILTIN_TYPES.map((type) => ({
        label: type,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: `${type}(\${1:})`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: "Built-in type",
        range,
      }));

      const exceptionSuggestions = EXCEPTIONS.map((exc) => ({
        label: exc,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: exc,
        detail: "Built-in exception",
        range,
      }));

      const snippetSuggestions = [
        {
          label: "def",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "def ${1:function_name}(${2:args}):\n\t${3:pass}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Function definition",
          range,
        },
        {
          label: "class",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "class ${1:ClassName}:\n\t${2:pass}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Class definition",
          range,
        },
        {
          label: "if",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "if ${1:condition}:\n\t${2:pass}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "If statement",
          range,
        },
        {
          label: "if/else",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "if ${1:condition}:",
            "\t${2:pass}",
            "else:",
            "\t${3:pass}",
          ].join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "If/else statement",
          range,
        },
        {
          label: "for",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "for ${1:item} in ${2:iterable}:\n\t${3:pass}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "For loop",
          range,
        },
        {
          label: "while",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "while ${1:condition}:\n\t${2:pass}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "While loop",
          range,
        },
        {
          label: "try/except",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "try:",
            "\t${1:pass}",
            "except ${2:Exception} as ${3:e}:",
            "\t${4:raise}",
          ].join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Try/except block",
          range,
        },
        {
          label: "with",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "with ${1:expression} as ${2:var}:\n    ${3:pass}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "With statement",
          range,
        },
        {
          label: "main",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "if __name__ == '__main__':\n\t${1:main()}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Script entry point",
          range,
        },
        {
          label: "list comprehension",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "[${1:expr} for ${2:item} in ${3:iterable}]",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "List comprehension",
          range,
        },
      ];

      return {
        suggestions: [
          ...keywordSuggestions,
          ...functionSuggestions,
          ...typeSuggestions,
          ...exceptionSuggestions,
          ...snippetSuggestions,
        ],
      };
    },
  });
}
