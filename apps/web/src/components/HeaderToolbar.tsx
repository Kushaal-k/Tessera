import type { Participant } from "@tessera/shared-types";
import type { PeerState } from "@tessera/collaboration";
import { getExecutionShortcutText } from "../utils/platformDetection.js";
import { Download, Play, Loader2, Bot } from "lucide-react";
import { CollaboratorAvatarGroup } from "./CollaboratorAvatarGroup.js";

export interface HeaderToolbarProps {
  readonly localParticipant: Participant;
  readonly peers: readonly PeerState[];
  readonly displayName: string;
  readonly onDisplayNameChange: (name: string) => void;
  readonly connected: boolean;
  readonly isRunning: boolean;
  readonly onRunCode: () => void;
  readonly onDownload: () => void;
  readonly canDownload: boolean;
  readonly onOpenAiPanel: () => void;
  readonly activeFileName: string | null;
}

export function HeaderToolbar({
  localParticipant,
  peers,
  displayName,
  onDisplayNameChange,
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
    <header className="flex h-12 items-center justify-between border-b border-white/[0.08] px-4 bg-[#09090b] select-none z-20">
      {/* Brand Lockup */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 border border-white/[0.08] text-white">
            <svg
              className="h-3.5 w-3.5 text-zinc-100"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <h1 className="flex items-baseline gap-1 text-sm font-medium tracking-tight text-zinc-100">
            <span>Tessera</span>
            <span className="text-xs font-mono text-zinc-500">.io</span>
          </h1>
        </div>

        <span className="hidden md:inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-900/80 border border-white/[0.08]">
          Sandbox
        </span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        {/* Collaborators Avatar Group (in place of Language Selector) */}
        <CollaboratorAvatarGroup
          localParticipant={localParticipant}
          peers={peers}
          displayName={displayName}
          onDisplayNameChange={onDisplayNameChange}
        />

        {/* Primary Run Code Button */}
        <button
          onClick={onRunCode}
          disabled={!connected || isRunning}
          title={`Run code (${shortcutText})`}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium select-none transition-colors duration-150 ${
            isRunning
              ? "bg-zinc-900 text-zinc-400 cursor-not-allowed border border-white/[0.08]"
              : !connected
                ? "bg-zinc-900/50 text-zinc-600 cursor-not-allowed border border-white/[0.08]"
                : "bg-zinc-100 text-zinc-950 hover:bg-white border border-white/20 cursor-pointer"
          }`}
        >
          {isRunning ? (
            <>
              <Loader2 className="animate-spin h-3.5 w-3.5 text-zinc-400" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-current text-zinc-950" />
              <span>Run</span>
              <kbd className="hidden md:inline-flex items-center rounded bg-zinc-200 px-1 py-0.2 text-[9px] font-mono text-zinc-800 ml-0.5">
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
          className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-zinc-900/80 text-zinc-400 transition-colors duration-150 hover:bg-zinc-800 hover:text-zinc-200 hover:border-white/[0.16] disabled:opacity-40 disabled:hover:bg-zinc-900/80 disabled:hover:text-zinc-400 cursor-pointer disabled:cursor-not-allowed"
        >
          <Download className="h-3.5 w-3.5" />
        </button>

        {/* AI Assistant Button */}
        <button
          type="button"
          onClick={onOpenAiPanel}
          className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900/80 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors duration-150 hover:bg-zinc-800 hover:border-white/[0.16] hover:text-zinc-100 cursor-pointer"
        >
          <Bot className="h-3.5 w-3.5 text-zinc-400" />
          <span className="hidden sm:inline">AI Panel</span>
        </button>
      </div>
    </header>
  );
}
