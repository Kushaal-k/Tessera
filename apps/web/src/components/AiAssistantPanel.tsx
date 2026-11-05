import { useState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import {
  Send,
  Bot,
  User,
  Copy,
  Check,
  Code2,
  Bug,
  TestTube2,
  Zap,
} from "lucide-react";
import { FileIcon } from "../utils/fileIcons.js";
import { getAiServiceHealth } from "../services/aiService.js";

export interface AiAssistantPanelProps {
  readonly activeFileName: string | null;
  readonly activeCode?: string;
  readonly language?: string;
}

interface Message {
  readonly id: string;
  readonly sender: "user" | "assistant";
  readonly text: string;
  readonly timestamp: string;
  readonly codeSnippet?: string;
}

const QUICK_ACTIONS = [
  {
    icon: Code2,
    label: "Explain Code",
    prompt: "Can you provide a clear and concise explanation of what this code does and its core architecture?",
  },
  {
    icon: Bug,
    label: "Find Bugs",
    prompt: "Analyze this file for potential bugs, edge cases, memory leaks, or unhandled errors.",
  },
  {
    icon: TestTube2,
    label: "Generate Tests",
    prompt: "Write comprehensive unit tests covering the critical paths and edge cases for this file.",
  },
  {
    icon: Zap,
    label: "Optimize",
    prompt: "Suggest performance optimizations and clean code improvements for this implementation.",
  },
];

function CodeSnippetBlock({
  code,
  language = "typescript",
}: {
  readonly code: string;
  readonly language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      // clipboard access error
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-zinc-800 bg-black shadow-xs">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/70 px-3 py-1 text-[10px] font-mono text-zinc-400">
        <span>{language}</span>
        <button
          type="button"
          onClick={handleCopyCode}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-x-auto text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderInlineText(line: string): ReactNode[] {
  const codeParts = line.split(/(`[^`]+`)/g);
  return codeParts.map((part, pIdx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={pIdx}
          className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-[11px] text-zinc-200 border border-zinc-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((sub, sIdx) => {
      if (sub.startsWith("**") && sub.endsWith("**") && sub.length > 4) {
        return (
          <strong key={`${pIdx}-${sIdx}`} className="font-semibold text-white">
            {sub.slice(2, -2)}
          </strong>
        );
      }
      return sub;
    });
  });
}

function renderTextLines(chunk: string): ReactNode[] {
  const lines = chunk.split("\n");
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={idx} className="h-1.5" />;
    }

    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={idx} className="font-bold text-white text-xs mt-2 mb-1 tracking-tight">
          {renderInlineText(trimmed.slice(4))}
        </h4>
      );
    }

    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={idx} className="font-bold text-white text-sm mt-2.5 mb-1 tracking-tight">
          {renderInlineText(trimmed.slice(3))}
        </h3>
      );
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return (
        <div key={idx} className="flex items-start gap-2 pl-1.5 py-0.5 text-zinc-300">
          <span className="text-zinc-400 font-bold leading-none mt-1">•</span>
          <span className="flex-1 leading-relaxed">{renderInlineText(trimmed.slice(2))}</span>
        </div>
      );
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      return (
        <div key={idx} className="flex items-start gap-2 pl-1.5 py-0.5 text-zinc-300">
          <span className="text-zinc-400 font-mono text-[11px] font-semibold">
            {numberedMatch[1]}.
          </span>
          <span className="flex-1 leading-relaxed">{renderInlineText(numberedMatch[2] ?? "")}</span>
        </div>
      );
    }

    return (
      <p key={idx} className="leading-relaxed text-zinc-300">
        {renderInlineText(line)}
      </p>
    );
  });
}

function FormattedMessageContent({ text }: { readonly text: string }) {
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const elements: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let keyIdx = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = text.slice(lastIndex, match.index);
      elements.push(
        <div key={`text-${keyIdx++}`} className="space-y-1">
          {renderTextLines(textChunk)}
        </div>,
      );
    }

    const lang = match[1] || "code";
    const code = match[2]?.trimEnd() ?? "";
    elements.push(
      <CodeSnippetBlock key={`code-${keyIdx++}`} code={code} language={lang} />,
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    elements.push(
      <div key={`text-${keyIdx++}`} className="space-y-1">
        {renderTextLines(remaining)}
      </div>,
    );
  }

  return <div className="space-y-1 text-xs">{elements}</div>;
}

export function AiAssistantPanel({
  activeFileName,
  activeCode,
  language = "typescript",
}: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hello! I am your AI code companion in Tessera. I have context on your active workspace and files. How can I help you build or debug today?",
      timestamp: "Just now",
    },
  ]);
  const [input, setInput] = useState("");
  const [isAiOnline, setIsAiOnline] = useState<boolean | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idCounterRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    getAiServiceHealth()
      .then((res) => {
        if (mounted) {
          setIsAiOnline(res.status === "healthy" || res.status === "ok");
        }
      })
      .catch(() => {
        if (mounted) {
          setIsAiOnline(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard access error
    }
  };

  const generateAssistantResponse = (userPrompt: string): string => {
    const fileDesc = activeFileName ? `'${activeFileName}'` : "the active workspace";
    const codeLength = activeCode?.length ?? 0;

    if (userPrompt.toLowerCase().includes("explain")) {
      return `### Overview of ${fileDesc}\n\nThis file is written in **${language}** (${codeLength} characters).\n\nKey highlights:\n- Provides modular, decoupled logic aligned with Tessera's architecture.\n- Interacts through clean function signatures and explicit control flow braces.\n- Maintains high cohesion and minimal external side effects.`;
    }

    if (userPrompt.toLowerCase().includes("bug")) {
      return `### Bug & Robustness Audit for ${fileDesc}\n\n1. **Boundary Validation**: Check for empty or undefined inputs before invoking internal methods.\n2. **State Cleanup**: Verify all effect listeners and event subscriptions are cleaned up on unmount.\n3. **Async Error Trapping**: Wrap external network calls in try/catch blocks with graceful fallbacks.`;
    }

    if (userPrompt.toLowerCase().includes("test")) {
      return `### Proposed Unit Tests for ${fileDesc}\n\n\`\`\`${language}\nimport { describe, it, expect } from "vitest";\n\ndescribe("${activeFileName ?? "ActiveModule"}", () => {\n  it("handles standard input correctly", () => {\n    // Test standard invocation\n    expect(true).toBe(true);\n  });\n\n  it("safely handles empty and boundary inputs", () => {\n    // Test edge cases\n    expect(false).toBe(false);\n  });\n});\n\`\`\``;
    }

    if (userPrompt.toLowerCase().includes("optimize")) {
      return `### Optimization Opportunities for ${fileDesc}\n\n- **Memoization**: Ensure expensive computations use \`useMemo\` and functions use \`useCallback\`.\n- **Render Isolation**: Keep volatile states local to leaf components to prevent redundant root re-renders.\n- **Data Structures**: Prefer Maps or Sets for frequent O(1) lookups over nested arrays.`;
    }

    return `I received your prompt: "${userPrompt}" regarding ${fileDesc}. Let me know if you would like me to generate code, refactor a function, or explain specific logic in detail!`;
  };

  const handleSendPrompt = (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) {
      return;
    }

    idCounterRef.current += 1;
    const userMsgId = `u-${idCounterRef.current}`;
    const userMsg: Message = {
      id: userMsgId,
      sender: "user",
      text: trimmed,
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Simulate responsive assistant thinking & replying
    setTimeout(() => {
      idCounterRef.current += 1;
      const assistantMsgId = `a-${idCounterRef.current}`;
      const reply = generateAssistantResponse(trimmed);
      const assistantMsg: Message = {
        id: assistantMsgId,
        sender: "assistant",
        text: reply,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }, 350);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSendPrompt(input);
  };

  return (
    <div className="flex flex-col h-full w-full text-zinc-200">
      {/* Active Context Banner */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-white/[0.08] bg-zinc-900/50 p-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {activeFileName ? (
            <FileIcon filename={activeFileName} className="h-4 w-4 shrink-0" />
          ) : (
            <Bot className="h-4 w-4 text-zinc-400 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-white truncate">
                {activeFileName ?? "No active file"}
              </span>
              <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400 border border-white/[0.08]">
                {language}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 truncate">
              {activeCode ? `${activeCode.split("\n").length} lines in context` : "Open a file to inject editor context"}
            </p>
          </div>
        </div>

        {/* AI Health Status Badge */}
        <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full bg-zinc-900 border border-white/[0.08] text-[10px]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isAiOnline ? "bg-emerald-400" : isAiOnline === false ? "bg-amber-400" : "bg-zinc-500"
            }`}
          />
          <span className="text-zinc-300 font-medium">
            {isAiOnline ? "Engine online" : isAiOnline === false ? "Local assist" : "Checking"}
          </span>
        </div>
      </div>

      {/* Quick Action Suggestion Chips */}
      <div className="mb-4">
        <p className="text-xs font-medium text-zinc-400 mb-1.5">
          Quick prompts
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  handleSendPrompt(action.prompt);
                }}
                className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-zinc-900/40 p-2 text-left text-xs text-zinc-300 transition-colors duration-150 hover:border-white/[0.16] hover:bg-zinc-800 hover:text-white cursor-pointer"
              >
                <Icon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <span className="font-medium text-[11px] truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-3">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isUser
                    ? "bg-zinc-100 text-black"
                    : "bg-zinc-900 text-zinc-300 border border-white/[0.08]"
                }`}
              >
                {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>

              <div
                className={`relative max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  isUser
                    ? "bg-zinc-100 text-zinc-950 font-normal"
                    : "bg-zinc-900/80 text-zinc-200 border border-white/[0.08]"
                }`}
              >
                {isUser ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  <FormattedMessageContent text={msg.text} />
                )}

                {!isUser && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyText(msg.id, msg.text);
                    }}
                    title="Copy response"
                    aria-label="Copy response"
                    className="absolute top-2 right-2 p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    {copiedId === msg.id ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Prompt Input Form */}
      <form onSubmit={handleSubmit} className="mt-auto pt-3 border-t border-white/[0.08]">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            placeholder={`Ask about ${activeFileName ?? "code"}...`}
            className="w-full rounded-lg border border-white/[0.08] bg-zinc-900/80 px-3.5 py-2.5 pr-10 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-white/[0.2] transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            title="Send prompt"
            aria-label="Send prompt"
            className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-950 transition-colors duration-150 hover:bg-white disabled:opacity-30 disabled:hover:bg-zinc-100 cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
