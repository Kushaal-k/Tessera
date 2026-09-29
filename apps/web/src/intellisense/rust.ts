import type * as Monaco from "monaco-editor";
import { createRange } from "./utils.js";

const RUST_KEYWORDS = [
  "as",
  "async",
  "await",
  "break",
  "const",
  "continue",
  "crate",
  "dyn",
  "else",
  "enum",
  "extern",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "static",
  "struct",
  "super",
  "trait",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
];

const STDLIB_TYPES = [
  "Arc",
  "Box",
  "Cow",
  "HashMap",
  "HashSet",
  "Option",
  "PathBuf",
  "Rc",
  "Result",
  "String",
  "Vec",
];

const MACROS = [
  "assert!",
  "assert_eq!",
  "dbg!",
  "eprintln!",
  "format!",
  "panic!",
  "print!",
  "println!",
  "todo!",
  "vec!",
];

const TRAITS = [
  "Clone",
  "Copy",
  "Debug",
  "Default",
  "Display",
  "Eq",
  "Hash",
  "IntoIterator",
  "Iterator",
  "Ord",
  "PartialEq",
  "PartialOrd",
];

export function registerRustIntelliSense(monaco: typeof Monaco): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("rust", {
    provideCompletionItems(model, position) {
      const range = createRange(monaco, model, position);

      const keywordSuggestions = RUST_KEYWORDS.map((keyword) => ({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        range,
      }));

      const typeSuggestions = STDLIB_TYPES.map((type) => ({
        label: type,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: type,
        detail: "Rust Standard Library",
        range,
      }));

      const macroSuggestions = MACROS.map((macro) => ({
        label: macro,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: macro,
        detail: "Rust macro",
        range,
      }));

      const traitSuggestions = TRAITS.map((trait) => ({
        label: trait,
        kind: monaco.languages.CompletionItemKind.Interface,
        insertText: trait,
        detail: "Rust trait",
        range,
      }));

      const snippetSuggestions = [
        {
          label: "fn",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "fn ${1:function_name}(${2:args}) -> ${3:()} {\n\t${4:todo!()}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Function definition",
          range,
        },
        {
          label: "match",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "match ${1:expr} {",
            "\t${2:pattern} => ${3:result},",
            "\t_ => ${4:default},",
            "}",
          ].join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Match expression",
          range,
        },
        {
          label: "impl",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "impl ${1:Type} {\n\t${2:// methods}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Impl block",
          range,
        },
        {
          label: "struct",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "struct ${1:Name} {",
            "\t${2:field}: ${3:Type},",
            "}",
          ].join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Struct definition",
          range,
        },
        {
          label: "enum",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            "enum ${1:Name} {",
            "\t${2:Variant1},",
            "\t${3:Variant2},",
            "}",
          ].join("\n"),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Enum definition",
          range,
        },
        {
          label: "trait",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "trait ${1:Name} {\n\t${2:fn method(&self);}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Trait definition",
          range,
        },
        {
          label: "for",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "for ${1:item} in ${2:iter} {\n\t${3:// loop body}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "For-in loop",
          range,
        },
        {
          label: "if let",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "if let ${1:Some(value)} = ${2:expr} {\n\t${3:// body}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "If-let pattern match",
          range,
        },
        {
          label: "while let",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "while let ${1:Some(value)} = ${2:iter.next()} {\n\t${3:// body}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "While-let loop",
          range,
        },
        {
          label: "mod",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "mod ${1:module_name} {\n\t${2:// contents}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Module definition",
          range,
        },
        {
          label: "use",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "use ${1:std::collections::HashMap};",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "Use declaration",
          range,
        },
      ];

      return {
        suggestions: [
          ...keywordSuggestions,
          ...typeSuggestions,
          ...macroSuggestions,
          ...traitSuggestions,
          ...snippetSuggestions,
        ],
      };
    },
  });
}
