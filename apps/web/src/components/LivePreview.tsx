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
    ChevronDown,
} from "lucide-react";

import { getExecutionEngineUrl } from "../services/executionEngine.js";
import { usePreviewStatus } from "../hooks/usePreviewStatus.js";

export type ViewportMode = "responsive" | "tablet" | "mobile";

const PREVIEW_PORTS = [
    { port: 5173, label: "Vite" },
    { port: 3000, label: "Node" },
    { port: 8080, label: "HTTP" },
    { port: 8000, label: "Python" },
] as const;

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
    const [portMenuOpen, setPortMenuOpen] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const portMenuRef = useRef<HTMLDivElement>(null);
    const { status, retry } = usePreviewStatus(workspaceId, port, active ?? true, serverUrl);

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const fullPreviewUrl = `${getExecutionEngineUrl(serverUrl)}/preview/${encodeURIComponent(workspaceId)}/${port}${cleanPath}`;

    const prevStatusRef = useRef<string>(status);

    useEffect(() => {
        if (!portMenuOpen) {
            return;
        }

        const handlePointerDown = (event: MouseEvent) => {
            if (portMenuRef.current && !portMenuRef.current.contains(event.target as Node)) {
                setPortMenuOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setPortMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [portMenuOpen]);

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

    const statusLabel =
        status === "ready"
            ? "Ready"
            : status === "not_listening"
              ? "Not listening"
              : status === "missing_runtime"
                ? "No runtime"
                : status === "unavailable"
                  ? "Unavailable"
                  : "Checking";
    const statusTone =
        status === "ready"
            ? "text-emerald-400"
            : status === "not_listening"
              ? "text-amber-400"
              : status === "unavailable"
                ? "text-rose-400"
                : "text-zinc-400";
    const statusDot =
        status === "ready"
            ? "bg-emerald-400"
            : status === "not_listening"
              ? "bg-amber-400"
              : status === "unavailable"
                ? "bg-rose-500"
                : "bg-zinc-500";

    return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-zinc-200 overflow-hidden">
      {/* Control Toolbar */}
      <div className="@container/preview relative z-20 flex min-w-0 items-center gap-1 px-2 py-1.5 bg-[#09090b] border-b border-white/[0.08] text-xs select-none">
        <div className="flex min-w-0 flex-1 items-center rounded-md border border-white/[0.08] bg-black/40 focus-within:border-white/[0.2]">
          <div ref={portMenuRef} className="relative flex shrink-0 items-center border-r border-white/[0.08]">
            <button
              type="button"
              aria-label="Target port"
              aria-haspopup="listbox"
              aria-expanded={portMenuOpen}
              onClick={() => {
                setPortMenuOpen((open) => !open);
              }}
              className="flex items-center gap-1 px-2 py-1 font-mono text-xs text-zinc-200"
            >
              <Globe className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <span>{port}</span>
              <ChevronDown className={`h-3 w-3 text-zinc-500 transition-transform duration-150 ${portMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {portMenuOpen ? (
              <div
                role="listbox"
                aria-label="Preview ports"
                className="absolute left-0 top-full z-50 mt-1 min-w-[9.5rem] overflow-hidden rounded-lg border border-white/[0.08] bg-[#09090b] py-1 shadow-xl shadow-black/80"
              >
                {PREVIEW_PORTS.map((option) => {
                  const selected = port === option.port;
                  return (
                    <button
                      key={option.port}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setPort(option.port);
                        setPortMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors duration-150 ${
                        selected
                          ? "bg-zinc-800 text-zinc-100"
                          : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
                      }`}
                    >
                      <span>{option.port}</span>
                      <span className={`font-sans text-[10px] ${selected ? "text-zinc-400" : "text-zinc-500"}`}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
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
            className="min-w-0 flex-1 bg-transparent px-2 py-1 font-mono text-[11px] text-zinc-200 outline-none"
          />
          <span
            title={statusLabel}
            aria-label={statusLabel}
            className={`mr-2 flex shrink-0 items-center gap-1.5 font-mono text-[10px] ${statusTone}`}
          >
            {status === "checking" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            )}
            <span className="hidden @min-[36rem]/preview:inline">{statusLabel}</span>
          </span>
        </div>

        <div className="flex shrink-0 items-center">
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
        <div className="hidden shrink-0 items-center gap-0.5 border-l border-white/[0.08] pl-2 @min-[40rem]/preview:flex">
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
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
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
          <div className="flex h-full w-full items-center justify-center overflow-y-auto px-4 py-2">
          <div className="flex w-full max-w-md flex-col items-center text-center">
            {status === "checking" ? (
              <div className="flex flex-col items-center gap-1.5">
                <Loader2 className="h-5 w-5 text-zinc-400 animate-spin" />
                <p className="text-sm font-medium text-zinc-300">Checking preview status...</p>
                <p className="text-xs text-zinc-500 font-mono">Verifying port {port} on workspace runtime</p>
              </div>
            ) : status === "not_listening" ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                  <TerminalSquare className="h-4 w-4" />
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
              <div className="flex flex-col items-center gap-1.5">
                <div className="p-1.5 bg-zinc-900 text-zinc-400 rounded-full border border-white/[0.08]">
                  <TerminalSquare className="h-4 w-4" />
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
              <div className="flex flex-col items-center gap-1.5">
                <div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20">
                  <AlertCircle className="h-4 w-4" />
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
          </div>
        )}
      </div>
    </div>
  );
}