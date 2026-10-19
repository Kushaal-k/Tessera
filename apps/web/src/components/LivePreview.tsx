import { useState, useRef, useEffect } from "react";
import {
    RefreshCw,
    ExternalLink,
    Globe,
    Monitor,
    Tablet,
    Smartphone,
    Loader2,
    TerminalSquare,
    AlertCircle,
} from "lucide-react";

import { getExecutionEngineUrl } from "../services/executionEngine.js";
import { usePreviewStatus } from "../hooks/usePreviewStatus.js";

export type ViewportMode = "responsive" | "tablet" | "mobile";

export interface LivePreviewProps {
    readonly workspaceId: string;
    readonly serverUrl?: string;
    readonly active?: boolean;
}

export function LivePreview({
    workspaceId,
    serverUrl,
    active,
}: LivePreviewProps) {
    const [port, setPort] = useState<number>(5173);
    const [path, setPath] = useState<string>("/");
    const [viewport, setViewport] = useState<ViewportMode>("responsive");
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const { status, retry } = usePreviewStatus(workspaceId, port, active ?? true, serverUrl);

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const fullPreviewUrl = `${getExecutionEngineUrl(serverUrl)}/preview/${encodeURIComponent(workspaceId)}/${port}${cleanPath}`;

    const prevStatusRef = useRef<string>(status);
    useEffect(() => {
        if (status === "ready" && prevStatusRef.current !== "ready") {
            if (iframeRef.current) {
                iframeRef.current.src = fullPreviewUrl;
            }
        }
        prevStatusRef.current = status;
    }, [status, fullPreviewUrl]);

    const handleRefresh = () => {
        retry();
        if (iframeRef.current) {
            iframeRef.current.src = fullPreviewUrl;
        }
    };

    const handlePopout = () => {
        window.open(fullPreviewUrl, "_blank", "noopener,noreferrer");
    };

    const viewportWidthClass = {
        responsive: "w-full",
        tablet: "w-[768px] max-w-full",
        mobile: "w-[375px] max-w-full",
    }[viewport];

    return (
    <div className="flex flex-col h-full w-full bg-[var(--color-surface,#0b1120)] text-slate-200 overflow-hidden">
      {/* Control Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-xs select-none">
        {/* Port Picker */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 rounded px-2 py-1 border border-slate-700/60">
          <Globe className="h-3.5 w-3.5 text-sky-400 shrink-0" />
          <select
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs font-mono"
          >
            <option value={5173} className="bg-slate-900 text-slate-200">5173 (Vite)</option>
            <option value={3000} className="bg-slate-900 text-slate-200">3000 (React/Node)</option>
            <option value={8080} className="bg-slate-900 text-slate-200">8080 (Http)</option>
            <option value={8000} className="bg-slate-900 text-slate-200">8000 (Python)</option>
          </select>
        </div>
        {/* Path Input */}
        <div className="flex-1 flex items-center">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRefresh();
              }
            }}
            placeholder="/"
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-sky-500 rounded px-2.5 py-1 text-slate-200 font-mono text-[11px] outline-none transition-colors"
          />
        </div>
        {/* Status Indicator Badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-700/60 bg-slate-800/50 text-[11px] font-mono shrink-0 select-none">
          {status === "ready" && (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Ready
            </span>
          )}
          {status === "not_listening" && (
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Not Listening
            </span>
          )}
          {status === "missing_runtime" && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              No Runtime
            </span>
          )}
          {status === "unavailable" && (
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Unavailable
            </span>
          )}
          {status === "checking" && (
            <span className="flex items-center gap-1.5 text-sky-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking
            </span>
          )}
        </div>
        {/* Reload & Popout Actions */}
        <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
          <button
            type="button"
            onClick={handleRefresh}
            title="Reload Preview"
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handlePopout}
            title="Open in New Tab"
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Viewport Preset Toggles */}
        <div className="flex items-center gap-0.5 border-l border-slate-800 pl-2">
          <button
            type="button"
            onClick={() => setViewport("responsive")}
            title="Responsive (100%)"
            className={`p-1 rounded transition-colors ${
              viewport === "responsive"
                ? "bg-slate-800 text-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewport("tablet")}
            title="Tablet (768px)"
            className={`p-1 rounded transition-colors ${
              viewport === "tablet"
                ? "bg-slate-800 text-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Tablet className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewport("mobile")}
            title="Mobile (375px)"
            className={`p-1 rounded transition-colors ${
              viewport === "mobile"
                ? "bg-slate-800 text-sky-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {/* Embedded Iframe Container or Diagnostic State */}
      <div className="flex-1 bg-slate-950/60 flex justify-center items-stretch overflow-hidden p-2 relative">
        {status === "ready" ? (
          <iframe
            ref={iframeRef}
            src={fullPreviewUrl}
            title="Live Web Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            className={`h-full ${viewportWidthClass} bg-white rounded border border-slate-800/80 shadow-2xl transition-all duration-200`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md my-auto">
            {status === "checking" ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-sky-400 animate-spin" />
                <p className="text-sm font-medium text-slate-300">Checking preview status...</p>
                <p className="text-xs text-slate-500">Verifying port {port} on workspace runtime</p>
              </div>
            ) : status === "not_listening" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                  <TerminalSquare className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200">Server Not Yet Listening</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Port <span className="font-mono text-amber-300">{port}</span> is not accepting connections yet. Start your development server (e.g. <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-200">npm run dev</code>) in the terminal.
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry Connection
                </button>
              </div>
            ) : status === "missing_runtime" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-slate-800/60 text-slate-400 rounded-full border border-slate-700">
                  <TerminalSquare className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200">Workspace Container Inactive</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No active container runtime exists for this workspace. Open a terminal session to start the container.
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry Probe
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200">Execution Engine Unavailable</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Unable to connect to the execution engine status service. Check your connection or server status.
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry Connection
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}