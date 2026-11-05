import { useState } from "react";
import {
  Terminal as TerminalIcon,
  Play,
  TerminalSquare,
  Globe,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { ExecutionResult } from "@tessera/shared-types";
import { getExecutionShortcutText } from "../utils/platformDetection.js";
import { Terminal } from "./Terminal.js";
import { LivePreview } from "./LivePreview.js";

export type BottomPanelTab = "terminal" | "output" | "preview";

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
  const [copiedOutput, setCopiedOutput] = useState<boolean>(false);
  const activeTab = controlledActiveTab ?? internalTab;

  const handleSelectTab = (tab: BottomPanelTab): void => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const handleCopyOutput = async (): Promise<void> => {
    if (!output) {
      return;
    }
    const text = [output.stdout, output.stderr].filter(Boolean).join("\n");
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 1500);
    } catch {
      // clipboard access error
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-black border-t border-zinc-800/80">
      {/* Dock Tabs Header */}
      <div className="flex h-9 items-center justify-between px-3 bg-black border-b border-zinc-800/80 select-none">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleSelectTab("terminal")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === "terminal"
                ? "bg-zinc-900 text-zinc-100 border border-zinc-800 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <TerminalIcon className="h-3.5 w-3.5 text-zinc-400" />
            <span>Terminal</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab("output")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === "output"
                ? "bg-zinc-900 text-zinc-100 border border-zinc-800 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <Play className="h-3.5 w-3.5 text-zinc-400" />
            <span>Execution Output</span>
            {isRunning && (
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab("preview")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeTab === "preview"
                ? "bg-zinc-900 text-zinc-100 border border-zinc-800 shadow-xs"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-zinc-400" />
            <span>Web Preview</span>
          </button>
        </div>

        {/* Output tab header metadata and quick actions */}
        {activeTab === "output" && output && (
          <div className="flex items-center gap-2.5 text-xs font-mono">
            <div className="flex items-center gap-1 text-zinc-400 text-[11px]">
              <Clock className="h-3 w-3 text-zinc-500" />
              <span>{output.durationMs}ms</span>
            </div>
            {output.exitCode !== null && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  output.exitCode === 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {output.exitCode === 0 ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <AlertCircle className="h-3 w-3" />
                )}
                Exit {output.exitCode}
              </span>
            )}
            <button
              type="button"
              onClick={() => { void handleCopyOutput(); }}
              title="Copy execution output"
              aria-label="Copy execution output"
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              {copiedOutput ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
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
          className={`h-full w-full p-2.5 flex flex-col overflow-hidden ${
            activeTab === "output" ? "block" : "hidden"
          }`}
        >
          <div className="flex-1 overflow-y-auto font-mono text-xs p-3 rounded-lg bg-black border border-zinc-800/80 shadow-inner">
            {isRunning ? (
              <div className="flex items-center gap-2.5 text-zinc-400 animate-pulse py-2">
                <TerminalSquare className="h-4 w-4" />
                <span>Running batch execution sandbox...</span>
              </div>
            ) : output ? (
              <div className="space-y-1.5 whitespace-pre-wrap leading-relaxed">
                {output.stdout && (
                  <div className="text-emerald-400 font-mono">{output.stdout}</div>
                )}
                {output.stderr && (
                  <div className="text-rose-400 font-mono font-medium">{output.stderr}</div>
                )}
                {!output.stdout && !output.stderr && (
                  <div className="text-zinc-500 italic">
                    No output returned (Process completed with exit code {output.exitCode}).
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-6">
                <TerminalSquare className="h-6 w-6 text-zinc-600 mb-1.5" />
                <p className="text-xs text-zinc-400 font-sans">Ready to execute code.</p>
                <p className="text-[11px] text-zinc-600 font-sans mt-0.5">
                  Click <span className="font-semibold text-zinc-300">Run</span> in toolbar or press <kbd className="px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[10px]">{getExecutionShortcutText()}</kbd>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Web Preview Tab */}
        <div
          className={`h-full w-full ${
            activeTab === "preview" ? "block" : "hidden"
          }`}
        >
          <LivePreview
            workspaceId={roomId ?? "default-room"}
            serverUrl={serverUrl}
            active={activeTab === "preview"}
          />
        </div>
      </div>
    </div>
  );
}
