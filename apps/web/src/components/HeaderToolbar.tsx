import type { SupportedLanguage } from "@tessera/shared-types";
import { getExecutionShortcutText } from "../utils/platformDetection.js";
import { Download, Play, Loader2 } from "lucide-react";

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
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 bg-[var(--color-surface)]">
      <h1 className="text-lg font-semibold tracking-tight text-white">
        Tessera<span className="text-tessera-500">.io</span>
      </h1>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Language:</span>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
            className="bg-[var(--color-bg)] text-sm text-white border border-[var(--color-border)] rounded px-2 py-1 focus:outline-none focus:border-tessera-500 font-medium"
          >
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
            <option value="rust">Rust</option>
            <option value="go">Go</option>
          </select>
        </div>

        <button
          onClick={onRunCode}
          disabled={!connected || isRunning}
          title={`Run code (${getExecutionShortcutText()})`}
          className={`flex items-center gap-1.5 px-3 py-1 text-sm font-semibold rounded transition shadow-sm ${
            isRunning
              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
              : !connected
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-tessera-600 hover:bg-tessera-500 text-white cursor-pointer active:scale-95"
          }`}
        >
          {isRunning ? (
            <>
              <Loader2 className="animate-spin h-3.5 w-3.5 text-slate-400" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current" />
              Run
            </>
          )}
        </button>

        <button
          onClick={onDownload}
          disabled={!canDownload}
          className="flex items-center justify-center p-1.5 text-slate-400 hover:text-white hover:bg-[var(--color-bg)] rounded transition"
          title={`Download ${activeFileName ?? "file"}`}
        >
          <Download className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onOpenAiPanel}
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-sm font-semibold text-slate-200 transition hover:border-tessera-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-tessera-500"
        >
          AI Panel
        </button>

        <div className="flex items-center gap-2 border-l border-[var(--color-border)] pl-4">
          <span
            className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`}
          />
          <span className="text-xs text-slate-400 font-medium">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>
    </header>
  );
}
