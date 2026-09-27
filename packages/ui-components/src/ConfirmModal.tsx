import { useEffect } from "react";

export interface ConfirmModalProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly className?: string;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  className = "",
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className={`w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl shadow-black/50 ${className}`}
      >
        <h2 id="confirm-modal-title" className="text-sm font-semibold text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            {description}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-500"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-rose-500 active:scale-95 focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
