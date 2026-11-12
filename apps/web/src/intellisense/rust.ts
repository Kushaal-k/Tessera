import type * as Monaco from "monaco-editor";
import { createRange } from "./utils.js";

export function registerRustIntelliSense(monaco: typeof Monaco): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("rust", {
    provideCompletionItems(model, position) {
      const range = createRange(monaco, model, position);

      const keywords: Monaco.languages.CompletionItem[] = [
        "fn", "let", "mut", "const", "static", "struct", "enum", "impl",
        "trait", "use", "mod", "pub", "crate", "super", "self", "Self",
        "match", "if", "else", "loop", "while", "for", "in", "return",
        "break", "continue", "where", "type", "as", "ref", "move",
        "unsafe", "extern", "dyn", "Box", "async", "await",
      ].map((kw) => ({
        label: kw,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: kw,
        range,
      }));

      const types: Monaco.languages.CompletionItem[] = [
        "Vec", "String", "str", "i8", "i16", "i32", "i64", "i128", "isize",
        "u8", "u16", "u32", "u64", "u128", "usize", "f32", "f64", "bool",
        "char", "Option", "Result", "HashMap", "HashSet", "BTreeMap",
        "BTreeSet", "Box", "Rc", "Arc", "Cell", "RefCell", "Mutex",
        "RwLock", "PathBuf", "Path",
      ].map((t) => ({
        label: t,
        kind: monaco.languages.CompletionItemKind.Class,
        insertText: t,
        range,
      }));

      const macros: Monaco.languages.CompletionItem[] = [
        "println!", "print!", "eprintln!", "eprint!", "format!", "vec!",
        "panic!", "assert!", "assert_eq!", "assert_ne!", "todo!", "unimplemented!",
        "unreachable!", "dbg!", "write!", "writeln!", "include_str!", "env!",
      ].map((m) => ({
        label: m,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: m.replace("!", ""),
        range,
      }));

      const traits: Monaco.languages.CompletionItem[] = [
        "Clone", "Copy", "Debug", "Display", "Default", "PartialEq", "Eq",
        "PartialOrd", "Ord", "Hash", "From", "Into", "Iterator", "IntoIterator",
        "Read", "Write", "Send", "Sync", "Sized", "Drop", "Fn", "FnMut", "FnOnce",
      ].map((t) => ({
        label: t,
        kind: monaco.languages.CompletionItemKind.Interface,
        insertText: t,
        range,
      }));

      const snippets: Monaco.languages.CompletionItem[] = [
        {
          label: "fn",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "fn ${1:name}(${2:args}) -> ${3:ReturnType} {\n\t${4}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Function definition",
          range,
        },
        {
          label: "fn main",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "fn main() {\n\t${1}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Main function",
          range,
        },
        {
          label: "struct",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "struct ${1:Name} {\n\t${2:field}: ${3:Type},\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Struct definition",
          range,
        },
        {
          label: "enum",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "enum ${1:Name} {\n\t${2:Variant1},\n\t${3:Variant2},\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Enum definition",
          range,
        },
        {
          label: "impl",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "impl ${1:Type} {\n\t${2}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Impl block",
          range,
        },
        {
          label: "impl trait",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "impl ${1:Trait} for ${2:Type} {\n\t${3}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Trait implementation",
          range,
        },
        {
          label: "match",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "match ${1:expr} {\n\t${2:pattern} => ${3:result},\n\t_ => ${4},\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Match expression",
          range,
        },
        {
          label: "if let",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "if let ${1:Some(val)} = ${2:expr} {\n\t${3}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "If let expression",
          range,
        },
        {
          label: "while let",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "while let ${1:Some(val)} = ${2:expr} {\n\t${3}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "While let loop",
          range,
        },
        {
          label: "for",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "for ${1:item} in ${2:iter} {\n\t${3}\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "For loop",
          range,
        },
        {
          label: "derive",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "#[derive(${1:Debug, Clone})]",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Derive macro",
          range,
        },
        {
          label: "Option match",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "match ${1:option} {\n\tSome(${2:val}) => ${3},\n\tNone => ${4},\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Match on Option",
          range,
        },
        {
          label: "Result match",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "match ${1:result} {\n\tOk(${2:val}) => ${3},\n\tErr(${4:e}) => ${5},\n}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Match on Result",
          range,
        },
      ];

      return { suggestions: [...keywords, ...types, ...macros, ...traits, ...snippets] };
    },
  });
}