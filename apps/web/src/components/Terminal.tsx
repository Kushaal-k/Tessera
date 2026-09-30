import { useState } from "react";
import { Check, Copy, RotateCcw, Terminal as TerminalIcon, Trash2 } from "lucide-react";
import { useTerminal } from "../hooks/useTerminal.js";
import "@xterm/xterm/css/xterm.css";

export interface TerminalProps {
  readonly roomId?: string;
  readonly className?: string;
  readonly serverUrl?: string;
}

export const TESSERA_TERMINAL_THEME = {
  background: "#0f172a", // slate-900 matching Tessera background
  foreground: "#e2e8f0", // slate-200
  cursor: "#38bdf8",     // sky-400 primary accent
  cursorAccent: "#0f172a",
  selectionBackground: "#334155", // slate-700
  selectionForeground: "#ffffff",
  black: "#0f172a",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  blue: "#38bdf8",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#f8fafc",
  brightBlack: "#475569",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#0ea5e9",
  brightMagenta: "#a855f7",
  brightCyan: "#06b6d4",
  brightWhite: "#ffffff",
};

export function Terminal({ roomId, className, serverUrl }: TerminalProps) {
  const { terminalRef, status, restartTerminal, clearBuffer, copyOutput } =
    useTerminal({ roomId, serverUrl });
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async (): Promise<void> => {
    const success = await copyOutput();
    if (success) {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    }
  };

  return (
    <div
      className={`relative flex flex-col h-full w-full overflow-hidden bg-[#0f172a] ${
        className ?? ""
      }`}
      data-status={status}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border,#1e293b)] bg-[var(--color-surface,#0b1120)] text-xs">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-semibold text-slate-300">Terminal</span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
              status === "connected"
                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                : status === "connecting"
                ? "bg-amber-950/60 text-amber-400 border border-amber-800/40 animate-pulse"
                : "bg-rose-950/60 text-rose-400 border border-rose-800/40"
            }`}
          >
            {status}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { void handleCopy(); }}
            title={copied ? "Copied!" : "Copy Output"}
            aria-label={copied ? "Copied!" : "Copy Output"}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={clearBuffer}
            title="Clear Buffer"
            aria-label="Clear Buffer"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={restartTerminal}
            title="Restart Terminal"
            aria-label="Restart Terminal"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={terminalRef}
        className="flex-1 w-full h-full overflow-hidden p-2"
        data-testid="terminal-container"
      />
    </div>
  );
}
