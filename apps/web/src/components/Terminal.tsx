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
  background: "#000000",
  foreground: "#f4f4f5",
  cursor: "#ffffff",
  cursorAccent: "#000000",
  selectionBackground: "#27272a",
  selectionForeground: "#ffffff",
  black: "#000000",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#38bdf8",
  white: "#f4f4f5",
  brightBlack: "#52525b",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#3b82f6",
  brightMagenta: "#a855f7",
  brightCyan: "#0ea5e9",
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
      className={`relative flex flex-col h-full w-full overflow-hidden bg-black ${
        className ?? ""
      }`}
      data-status={status}
    >
      <div className="flex h-8 items-center justify-between px-3 border-b border-zinc-800/80 bg-black text-xs">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-[11px] font-mono text-zinc-400 font-medium">bash (pty)</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === "connected"
                  ? "bg-emerald-400"
                  : status === "connecting"
                    ? "bg-zinc-500"
                    : "bg-rose-400"
              }`}
            />
            {status}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { void handleCopy(); }}
            title={copied ? "Copied!" : "Copy Output"}
            aria-label={copied ? "Copied!" : "Copy Output"}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
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
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={restartTerminal}
            title="Restart Terminal"
            aria-label="Restart Terminal"
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
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
