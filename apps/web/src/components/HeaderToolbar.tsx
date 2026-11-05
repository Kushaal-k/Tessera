import type { SupportedLanguage } from "@tessera/shared-types";
import { getExecutionShortcutText } from "../utils/platformDetection.js";
import { Download, Play, Loader2, Sparkles } from "lucide-react";

export interface HeaderToolbarProps {
  readonly language: SupportedLanguage;
  readonly onLanguageChange: (language: SupportedLanguage) => void;
  readonly connected: boolean;
  readonly isRunning: boolean;
  readonly onRunCode: () => void;
  readonly onDownload: () => void;
  readonly canDownload: boolean;
  readonly onOpenAiPanel: () => void;
  readonly activeFileName: string | null;
}

const LANGUAGE_DOT_COLORS: Record<SupportedLanguage, string> = {
  typescript: "bg-sky-400",
  python: "bg-amber-400",
  cpp: "bg-blue-400",
  java: "bg-rose-400",
  rust: "bg-orange-400",
  go: "bg-cyan-400",
};

export function HeaderToolbar({
  language,
  onLanguageChange,
  connected,
  isRunning,
  onRunCode,
  onDownload,
  canDownload,
  onOpenAiPanel,
  activeFileName,
}: HeaderToolbarProps) {
  const shortcutText = getExecutionShortcutText();

  return (
    <header className="flex h-12 items-center justify-between border-b border-zinc-800/80 px-4 bg-black/95 backdrop-blur-md select-none z-20">
      {/* Brand Lockup */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 border border-zinc-800 text-white shadow-xs">
            <svg
              className="h-4 w-4 text-zinc-100"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              Tessera
            </span>
            <span className="text-xs font-mono font-medium text-zinc-500">.io</span>
          </div>
        </div>

        <span className="hidden md:inline-flex items-center rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] font-mono font-medium text-zinc-400 border border-zinc-800">
          Sandbox
        </span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Language Selector */}
        <div className="relative flex items-center">
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/90 px-2.5 py-1 text-xs text-zinc-200 shadow-xs hover:border-zinc-700 transition-colors">
            <span
              className={`h-2 w-2 rounded-full ${LANGUAGE_DOT_COLORS[language] ?? "bg-zinc-400"}`}
              aria-hidden="true"
            />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
              aria-label="Language selection"
              className="bg-transparent text-xs text-zinc-200 outline-none cursor-pointer font-medium pr-1"
            >
              <option value="typescript" className="bg-zinc-900 text-zinc-200">TypeScript</option>
              <option value="python" className="bg-zinc-900 text-zinc-200">Python</option>
              <option value="cpp" className="bg-zinc-900 text-zinc-200">C++</option>
              <option value="java" className="bg-zinc-900 text-zinc-200">Java</option>
              <option value="rust" className="bg-zinc-900 text-zinc-200">Rust</option>
              <option value="go" className="bg-zinc-900 text-zinc-200">Go</option>
            </select>
          </div>
        </div>

        {/* Primary Run Code Button */}
        <button
          onClick={onRunCode}
          disabled={!connected || isRunning}
          title={`Run code in execution engine (${shortcutText})`}
          className={`group flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold shadow-xs transition-all select-none ${
            isRunning
              ? "bg-zinc-900 text-zinc-400 cursor-not-allowed border border-zinc-800"
              : !connected
                ? "bg-zinc-900/50 text-zinc-600 cursor-not-allowed border border-zinc-800"
                : "bg-zinc-100 text-zinc-950 hover:bg-white active:scale-95 border border-white/20 cursor-pointer"
          }`}
        >
          {isRunning ? (
            <>
              <Loader2 className="animate-spin h-3.5 w-3.5 text-zinc-400" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current text-zinc-950 transition-transform group-hover:scale-110" />
              <span>Run</span>
              <kbd className="hidden md:inline-flex items-center rounded bg-zinc-200 px-1 py-0.5 text-[9px] font-mono text-zinc-800 border border-zinc-300 ml-0.5">
                {shortcutText}
              </kbd>
            </>
          )}
        </button>

        {/* Download File Action */}
        <button
          onClick={onDownload}
          disabled={!canDownload}
          aria-label={`Download ${activeFileName ?? "active file"}`}
          title={canDownload ? `Download ${activeFileName ?? "active file"}` : "No file to download"}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-900/80 disabled:hover:text-zinc-400 cursor-pointer disabled:cursor-not-allowed"
        >
          <Download className="h-3.5 w-3.5" />
        </button>

        {/* AI Assistant Button */}
        <button
          type="button"
          onClick={onOpenAiPanel}
          className="group flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-800 hover:border-zinc-700 hover:text-white cursor-pointer active:scale-95 shadow-xs"
        >
          <Sparkles className="h-3.5 w-3.5 text-zinc-400 transition-transform group-hover:rotate-12 group-hover:text-zinc-200" />
          <span className="hidden sm:inline">AI Panel</span>
        </button>

        {/* Connection Status Live Pill */}
        <div
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-mono font-medium transition-colors ${
            connected
              ? "border-zinc-800 bg-zinc-900/80 text-zinc-300"
              : "border-rose-900/50 bg-rose-950/30 text-rose-400"
          }`}
          title={connected ? "Connected to real-time CRDT sync server" : "Disconnected from sync server"}
        >
          <span className="relative flex h-2 w-2">
            {connected ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            ) : null}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                connected ? "bg-emerald-400" : "bg-rose-400 animate-pulse"
              }`}
            />
          </span>
          <span className="hidden lg:inline">{connected ? "Connected" : "Offline"}</span>
        </div>
      </div>
    </header>
  );
}
