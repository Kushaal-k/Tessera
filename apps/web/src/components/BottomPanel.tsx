import { useState } from "react";
import { Terminal as TerminalIcon, Play, TerminalSquare } from "lucide-react";
import type { ExecutionResult } from "@tessera/shared-types";
import { Terminal } from "./Terminal.js";

export type BottomPanelTab = "terminal" | "output";

export interface BottomPanelProps {
  readonly isRunning: boolean;
  readonly output: ExecutionResult | null;
  readonly roomId?: string;
  readonly serverUrl?: string;
  readonly activeTab?: BottomPanelTab;
  readonly onTabChange?: (tab: BottomPanelTab) => void;
}

export function BottomPanel({
  isRunning,
  output,
  roomId,
  serverUrl,
  activeTab: controlledActiveTab,
  onTabChange,
}: BottomPanelProps) {
  const [internalTab, setInternalTab] = useState<BottomPanelTab>("terminal");
  const activeTab = controlledActiveTab ?? internalTab;

  const handleSelectTab = (tab: BottomPanelTab): void => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[var(--color-surface,#0b1120)] border-t border-[var(--color-border,#1e293b)]">
      {/* Dock Tabs Header */}
      <div className="flex items-center justify-between px-3 py-1 bg-[var(--color-surface,#0b1120)] border-b border-[var(--color-border,#1e293b)] select-none">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleSelectTab("terminal")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === "terminal"
                ? "bg-slate-800 text-slate-100 border border-slate-700/60"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <TerminalIcon className="h-3.5 w-3.5 text-sky-400" />
            Terminal
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab("output")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === "output"
                ? "bg-slate-800 text-slate-100 border border-slate-700/60"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Play className="h-3.5 w-3.5 text-emerald-400" />
            Execution Output
            {isRunning && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>

        {activeTab === "output" && output && (
          <div className="flex items-center gap-3 text-xs font-medium">
            <span
              className={
                output.status === "completed"
                  ? "text-emerald-400"
                  : "text-rose-400"
              }
            >
              Status: {output.status}
            </span>
            <span className="text-slate-400">
              Duration: {output.durationMs}ms
            </span>
            {output.exitCode !== null && (
              <span
                className={
                  output.exitCode === 0 ? "text-emerald-400" : "text-rose-400"
                }
              >
                Exit Code: {output.exitCode}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dock Content Body */}
      <div className="flex-1 overflow-hidden relative">
        {/* Terminal Tab */}
        <div
          className={`h-full w-full ${
            activeTab === "terminal" ? "block" : "hidden"
          }`}
        >
          <Terminal roomId={roomId} serverUrl={serverUrl} />
        </div>

        {/* Execution Output Tab */}
        <div
          className={`h-full w-full p-3 flex flex-col overflow-hidden ${
            activeTab === "output" ? "block" : "hidden"
          }`}
        >
          <div className="flex-1 overflow-y-auto font-mono text-xs p-3 rounded bg-[var(--color-bg,#0f172a)] border border-[var(--color-border,#1e293b)]">
            {isRunning ? (
              <div className="flex items-center gap-2 text-tessera-400 animate-pulse">
                <TerminalSquare className="h-4 w-4" />
                Running execution sandbox...
              </div>
            ) : output ? (
              <div className="space-y-1 whitespace-pre-wrap">
                {output.stdout && (
                  <div className="text-emerald-300">{output.stdout}</div>
                )}
                {output.stderr && (
                  <div className="text-rose-400 font-semibold">
                    {output.stderr}
                  </div>
                )}
                {!output.stdout && !output.stderr && (
                  <div className="text-slate-500 italic">
                    No output returned (Process completed with exit code{" "}
                    {output.exitCode}).
                  </div>
                )}
              </div>
            ) : (
              <span className="text-slate-500">
                Ready to execute. Click "Run" in the toolbar to run code in the batch sandbox.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
