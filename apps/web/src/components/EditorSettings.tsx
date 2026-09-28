export interface EditorSettingsProps {
  readonly showMinimap: boolean;
  readonly onShowMinimapChange: (value: boolean) => void;
  readonly fontSize: number;
  readonly onFontSizeChange: (value: number) => void;
}

export function EditorSettings({
  showMinimap,
  onShowMinimapChange,
  fontSize,
  onFontSizeChange,
}: EditorSettingsProps) {
  return (
    <div className="mt-auto border-t border-[var(--color-border)] pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Editor Settings
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label htmlFor="minimap-toggle" className="text-xs font-medium text-slate-300 cursor-pointer select-none">
            Show Minimap
          </label>
          <label htmlFor="minimap-toggle" className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="minimap-toggle"
              checked={showMinimap}
              onChange={(e) => onShowMinimapChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-tessera-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">Font Size</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onFontSizeChange(Math.max(10, fontSize - 1))}
              disabled={fontSize <= 10}
              className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-slate-300 hover:text-white disabled:opacity-40 select-none transition-all active:scale-95"
            >
              A-
            </button>
            <span className="text-xs font-mono font-medium text-slate-200 min-w-[28px] text-center">
              {fontSize}px
            </span>
            <button
              onClick={() => onFontSizeChange(Math.min(24, fontSize + 1))}
              disabled={fontSize >= 24}
              className="w-6 h-6 flex items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-slate-300 hover:text-white disabled:opacity-40 select-none transition-all active:scale-95"
            >
              A+
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
