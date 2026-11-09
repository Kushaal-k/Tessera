import { useState, useRef, useEffect, useCallback } from "react";
import type { Participant } from "@tessera/shared-types";
import type { PeerState } from "@tessera/collaboration";
import { Users, Check, X } from "lucide-react";

export interface CollaboratorAvatarGroupProps {
  readonly localParticipant: Participant;
  readonly peers: readonly PeerState[];
  readonly displayName: string;
  readonly onDisplayNameChange: (name: string) => void;
  readonly maxVisible?: number;
}

function getInitials(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) {
    return "A";
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function CollaboratorAvatarGroup({
  localParticipant,
  peers,
  displayName,
  onDisplayNameChange,
  maxVisible = 3,
}: CollaboratorAvatarGroupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingName, setEditingName] = useState(displayName);
  const [prevDisplayName, setPrevDisplayName] = useState(displayName);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (displayName !== prevDisplayName) {
    setPrevDisplayName(displayName);
    setEditingName(displayName);
  }

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClose]);

  const handleNameSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    const trimmed = editingName.trim();
    if (trimmed) {
      onDisplayNameChange(trimmed);
    }
  };

  const validPeers = peers.filter((p) => p.participant !== null);
  const allCollaborators = [
    {
      id: localParticipant.id,
      displayName: displayName.trim() || localParticipant.displayName,
      cursorColor: localParticipant.cursorColor,
      isLocal: true,
    },
    ...validPeers.map((p) => ({
      id: String(p.clientId),
      displayName: p.participant?.displayName || "Anonymous",
      cursorColor: p.participant?.cursorColor || "#64748b",
      isLocal: false,
    })),
  ];

  const visibleCollaborators = allCollaborators.slice(0, maxVisible);
  const overflowCount = Math.max(0, allCollaborators.length - maxVisible);

  return (
    <div className="relative flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="View collaborators"
        className="flex items-center -space-x-2 p-0.5 rounded-full hover:opacity-90 transition-opacity cursor-pointer select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
      >
        {visibleCollaborators.map((collaborator) => (
          <div
            key={collaborator.id}
            className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#09090b] text-[11px] font-semibold text-white shadow-sm transition-transform duration-150 hover:z-10 hover:scale-105"
            style={{ backgroundColor: collaborator.cursorColor }}
            title={`${collaborator.displayName}${collaborator.isLocal ? " (You)" : ""}`}
          >
            {getInitials(collaborator.displayName)}
          </div>
        ))}

        {overflowCount > 0 && (
          <div className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#09090b] bg-zinc-800 text-[11px] font-medium text-zinc-300 shadow-sm transition-transform duration-150 hover:z-10 hover:scale-105">
            +{overflowCount}
          </div>
        )}
      </button>

      {/* Collaborators Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Collaborators list"
          className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-white/[0.08] bg-[#09090b] p-3 shadow-xl shadow-black/80 z-50 animate-in fade-in zoom-in-95 duration-100 select-none"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-200">
                Collaborators
              </span>
              <span className="rounded bg-zinc-900 px-1.5 py-0.2 text-[10px] font-mono text-zinc-400 border border-white/[0.08]">
                {allCollaborators.length}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close collaborators popover"
              className="rounded p-0.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Unified Collaborators List */}
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {/* Local Participant (You) */}
            <div className="flex items-center gap-2 rounded-md p-1.5 hover:bg-zinc-900/40 transition-colors">
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-white/10"
                style={{ backgroundColor: localParticipant.cursorColor }}
                aria-hidden="true"
              >
                {getInitials(displayName)}
              </div>
              <form
                onSubmit={handleNameSubmit}
                className="flex flex-1 items-center gap-1 min-w-0"
              >
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => {
                    setEditingName(e.target.value);
                  }}
                  onBlur={() => {
                    handleNameSubmit();
                  }}
                  maxLength={32}
                  placeholder="Your name"
                  aria-label="Your display name"
                  className="w-full min-w-0 rounded border border-white/[0.08] bg-black/50 px-2 py-0.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-white/20 outline-none transition-colors"
                />
                {editingName.trim() !== displayName.trim() && (
                  <button
                    type="submit"
                    title="Save name"
                    aria-label="Save name"
                    className="rounded p-1 text-emerald-400 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                )}
              </form>
              <span className="text-[10px] text-zinc-500 font-mono shrink-0 px-1.5 py-0.5 rounded bg-zinc-800/80 border border-white/5">
                You
              </span>
            </div>

            {/* Remote Peers */}
            {validPeers.map((peer) => (
              <div
                key={peer.clientId}
                className="flex items-center gap-2 p-1.5 rounded-md hover:bg-zinc-900/40 transition-colors"
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-white/10"
                  style={{
                    backgroundColor:
                      peer.participant?.cursorColor || "#64748b",
                  }}
                >
                  {getInitials(peer.participant?.displayName)}
                </div>
                <span className="text-xs text-zinc-300 truncate">
                  {peer.participant?.displayName || "Anonymous"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
