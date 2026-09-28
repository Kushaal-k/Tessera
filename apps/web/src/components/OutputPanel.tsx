import type { ExecutionResult } from "@tessera/shared-types";

export interface OutputPanelProps {
  readonly isRunning: boolean;
  readonly output: ExecutionResult | null;
}

export function OutputPanel({ isRunning, output }: OutputPanelProps) {
  return (
    <div className="h-56 shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col p-3 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Execution Output
        </p>
        {output && (
          <div className="flex gap-4 text-xs font-medium">
            <span className={output.status === "completed" ? "text-emerald-400" : "text-rose-400"}>
              Status: {output.status}
            </span>
            <span className="text-slate-400">Duration: {output.durationMs}ms</span>
            {output.exitCode !== null && (
              <span className={output.exitCode === 0 ? "text-emerald-400" : "text-rose-400"}>
                Exit Code: {output.exitCode}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-xs p-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
        {isRunning ? (
          <span className="text-tessera-400 animate-pulse">Running execution sandbox...</span>
        ) : output ? (
          <div className="space-y-1 whitespace-pre-wrap">
            {output.stdout && <div className="text-emerald-300">{output.stdout}</div>}
            {output.stderr && <div className="text-rose-400 font-semibold">{output.stderr}</div>}
            {!output.stdout && !output.stderr && (
              <div className="text-slate-500 italic">
                No output returned (Process completed with exit code {output.exitCode}).
              </div>
            )}
          </div>
        ) : (
          <span className="text-slate-500">Ready to execute. Write some code and click "Run".</span>
        )}
      </div>
    </div>
  );
}
