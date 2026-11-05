import type { ExecutionResult } from "@tessera/shared-types";

export interface OutputPanelProps {
  readonly isRunning: boolean;
  readonly output: ExecutionResult | null;
}

export function OutputPanel({ isRunning, output }: OutputPanelProps) {
  return (
    <div className="h-56 shrink-0 border-t border-zinc-800/80 bg-black flex flex-col p-3 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Execution Output
        </p>
        {output && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className={output.status === "completed" ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
              {output.status}
            </span>
            <span className="text-zinc-400">{output.durationMs}ms</span>
            {output.exitCode !== null && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  output.exitCode === 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                Exit {output.exitCode}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs p-3 rounded-lg bg-black border border-zinc-800/80 shadow-inner">
        {isRunning ? (
          <span className="text-zinc-400 animate-pulse">Running execution sandbox...</span>
        ) : output ? (
          <div className="space-y-1 whitespace-pre-wrap">
            {output.stdout && <div className="text-emerald-400">{output.stdout}</div>}
            {output.stderr && <div className="text-rose-400 font-medium">{output.stderr}</div>}
            {!output.stdout && !output.stderr && (
              <div className="text-zinc-500 italic">
                No output returned (Process completed with exit code {output.exitCode}).
              </div>
            )}
          </div>
        ) : (
          <span className="text-zinc-500 text-xs font-sans">Ready to execute. Write some code and click "Run".</span>
        )}
      </div>
    </div>
  );
}
