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
        tablet: "w-[768px]",
        mobile: "w-[375px]",
    }[viewport];

    return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-zinc-200 overflow-hidden">
      {/* Control Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#09090b] border-b border-white/[0.08] text-xs select-none">
        {/* Port Picker */}
        <div className="flex items-center gap-1.5 bg-zinc-900/80 rounded-md px-2 py-1 border border-white/[0.08]">
          <Globe className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <select
            value={port}
            onChange={(e) => {
              setPort(Number(e.target.value));
            }}
            aria-label="Target port"
            className="bg-transparent text-zinc-200 outline-none cursor-pointer text-xs font-mono font-medium"
          >
            <option value={5173} className="bg-zinc-900 text-zinc-200">5173 (Vite)</option>
            <option value={3000} className="bg-zinc-900 text-zinc-200">3000 (Node)</option>
            <option value={8080} className="bg-zinc-900 text-zinc-200">8080 (HTTP)</option>
            <option value={8000} className="bg-zinc-900 text-zinc-200">8000 (Python)</option>
          </select>
        </div>

        {/* Address Bar */}
        <div className="flex-1 flex items-center bg-black/60 border border-white/[0.08] focus-within:border-white/[0.2] rounded-md px-2.5 py-1 text-[11px] font-mono transition-colors">
          <span className="text-zinc-500 select-none mr-1">http://localhost:{port}</span>
          <input
            type="text"
            value={path}
            onChange={(e) => {
              setPath(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRefresh();
              }
            }}
            placeholder="/"
            aria-label="Preview path"
            className="w-full bg-transparent text-zinc-200 outline-none"
          />
        </div>

        {/* Status Indicator Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/[0.08] bg-zinc-900/60 text-[10px] font-mono shrink-0 select-none">
          {status === "ready" && (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Ready
            </span>
          )}
          {status === "not_listening" && (
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Not listening
            </span>
          )}
          {status === "missing_runtime" && (
            <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
              No runtime
            </span>
          )}
          {status === "unavailable" && (
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Unavailable
            </span>
          )}
          {status === "checking" && (
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
              Checking
            </span>
          )}
        </div>

        {/* Reload & Popout Actions */}
        <div className="flex items-center gap-0.5 border-l border-white/[0.08] pl-2">
          <button
            type="button"
            onClick={handleRefresh}
            title="Reload preview"
            aria-label="Reload preview"
            className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors duration-150"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handlePopout}
            title="Open in new tab"
            aria-label="Open in new tab"
            className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors duration-150"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Viewport Preset Toggles */}
        <div className="flex items-center gap-0.5 border-l border-white/[0.08] pl-2">
          <button
            type="button"
            onClick={() => {
              setViewport("responsive");
            }}
            title="Responsive viewport (100%)"
            aria-label="Responsive viewport"
            className={`p-1 rounded-md transition-colors duration-150 ${
              viewport === "responsive"
                ? "bg-zinc-800 text-zinc-100 border border-white/[0.08]"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setViewport("tablet");
            }}
            title="Tablet viewport (768px)"
            aria-label="Tablet viewport"
            className={`p-1 rounded-md transition-colors duration-150 ${
              viewport === "tablet"
                ? "bg-zinc-800 text-zinc-100 border border-white/[0.08]"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <Tablet className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setViewport("mobile");
            }}
            title="Mobile viewport (375px)"
            aria-label="Mobile viewport"
            className={`p-1 rounded-md transition-colors duration-150 ${
              viewport === "mobile"
                ? "bg-zinc-800 text-zinc-100 border border-white/[0.08]"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Embedded Iframe Container or Diagnostic State */}
      <div className="flex-1 bg-black flex justify-center items-stretch overflow-hidden p-2 relative">
        {status === "ready" ? (
          viewport === "responsive" ? (
            <iframe
              ref={iframeRef}
              src={fullPreviewUrl}
              title="Live Web Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              className="h-full w-full bg-white rounded-lg border border-white/[0.08] transition-all duration-150"
            />
          ) : (
            <div className={`h-full ${viewportWidthClass} max-w-full flex flex-col items-center py-1 transition-all duration-150`}>
              <div className="w-full h-full flex flex-col rounded-xl border border-white/[0.12] bg-zinc-900 overflow-hidden ring-1 ring-white/5">
                <div className="h-3.5 bg-zinc-800/80 flex items-center justify-center shrink-0 border-b border-white/[0.06]">
                  <div className="w-8 h-1 rounded-full bg-zinc-600" />
                </div>
                <iframe
                  ref={iframeRef}
                  src={fullPreviewUrl}
                  title="Live Web Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                  className="flex-1 w-full bg-white border-0"
                />
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-md my-auto">
            {status === "checking" ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-7 w-7 text-zinc-400 animate-spin" />
                <p className="text-sm font-medium text-zinc-300">Checking preview status...</p>
                <p className="text-xs text-zinc-500 font-mono">Verifying port {port} on workspace runtime</p>
              </div>
            ) : status === "not_listening" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                  <TerminalSquare className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-medium text-zinc-200">Server not yet listening</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Port <span className="font-mono text-amber-300">{port}</span> is not accepting connections yet. Start your development server (e.g. <code className="bg-zinc-900 border border-white/[0.08] px-1 py-0.5 rounded text-zinc-300 font-mono">npm run dev</code>) in the terminal.
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-colors duration-150 border border-white/[0.08]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry connection
                </button>
              </div>
            ) : status === "missing_runtime" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="p-2.5 bg-zinc-900 text-zinc-400 rounded-full border border-white/[0.08]">
                  <TerminalSquare className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-medium text-zinc-200">Workspace container inactive</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  No active container runtime exists for this workspace. Open a terminal session to start the container.
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-colors duration-150 border border-white/[0.08]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry probe
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-medium text-zinc-200">Execution engine unavailable</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Unable to connect to the execution engine status service. Check your connection or server status.
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-colors duration-150 border border-white/[0.08]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry connection
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}