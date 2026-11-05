import { useEffect, type ReactNode } from "react";

export interface SidePanelProps {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly description?: string;
  readonly footer?: ReactNode;
  readonly className?: string;
}

export function SidePanel({
  open,
  title,
  children,
  onClose,
  description,
  footer,
  className = "",
}: SidePanelProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <>
      {open ? (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs transition-opacity duration-200"
        />
      ) : null}
      <aside
        aria-hidden={!open}
        aria-label={title}
        inert={!open ? true : undefined}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md transform flex-col border-l border-white/[0.08] bg-[#09090b] shadow-2xl shadow-black ring-1 ring-white/5 transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        } ${className}`}
      >
        <header className="flex min-h-14 items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-3.5 bg-[#09090b]">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium text-white">{title}</h2>
            {description ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-zinc-900 text-zinc-400 transition-colors duration-150 hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer ? (
          <footer className="border-t border-white/[0.08] px-5 py-3.5 bg-[#09090b]">
            {footer}
          </footer>
        ) : null}
      </aside>
    </>
  );
}
