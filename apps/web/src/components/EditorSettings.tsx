import { useState } from "react";
import { Sliders, Minus, Plus, ChevronDown, ChevronRight } from "lucide-react";

export interface EditorSettingsProps {
  readonly showMinimap: boolean;
  readonly onShowMinimapChange: (value: boolean) => void;
  readonly fontSize: number;
  readonly onFontSizeChange: (value: number) => void;
  readonly defaultExpanded?: boolean;
}

export function EditorSettings({
  showMinimap,
  onShowMinimapChange,
  fontSize,
  onFontSizeChange,
  defaultExpanded = false,
}: EditorSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="mt-auto border-t border-white/[0.08] pt-3">
      <div className="rounded-lg border border-white/[0.08] bg-zinc-900/50 p-2.5 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setIsExpanded((prev) => !prev);
          }}
          aria-expanded={isExpanded}
          aria-controls="editor-settings-content"
          className="flex w-full items-center justify-between text-zinc-400 hover:text-zinc-200 transition-colors select-none"
        >
          <div className="flex items-center gap-1.5">
            <Sliders className="h-3 w-3 text-zinc-500" />
            <span className="text-xs font-medium text-zinc-400">
              Editor
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
          )}
        </button>

        {isExpanded && (
          <div id="editor-settings-content" className="flex flex-col gap-2.5 pt-1.5 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <label htmlFor="minimap-toggle" className="text-xs text-zinc-300 cursor-pointer select-none">
                Minimap
              </label>
              <label htmlFor="minimap-toggle" className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="minimap-toggle"
                  checked={showMinimap}
                  onChange={(e) => {
                    onShowMinimapChange(e.target.checked);
                  }}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-zinc-800 border border-white/[0.08] rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 peer-checked:after:bg-black after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-zinc-200 peer-checked:border-white shadow-inner"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Font size</span>
              <div className="flex items-center gap-1 bg-black/60 rounded-md p-0.5 border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    onFontSizeChange(Math.max(10, fontSize - 1));
                  }}
                  disabled={fontSize <= 10}
                  title="Decrease font size"
                  aria-label="Decrease font size"
                  className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 select-none transition-colors duration-150"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="text-[11px] font-mono font-medium text-zinc-200 min-w-[28px] text-center select-none tabular-nums">
                  {fontSize}px
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onFontSizeChange(Math.min(24, fontSize + 1));
                  }}
                  disabled={fontSize >= 24}
                  title="Increase font size"
                  aria-label="Increase font size"
                  className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 select-none transition-colors duration-150"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
