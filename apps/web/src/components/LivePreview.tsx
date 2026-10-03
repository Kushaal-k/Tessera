import { useState, useRef } from "react";
import {
    RefreshCw,
    ExternalLink,
    Globe,
    Monitor,
    Tablet,
    Smartphone,
} from "lucide-react";

import { getExecutionEngineUrl } from "../services/executionEngine.js";

export type ViewportMode = "responsive" | "tablet" | "mobile";

export interface LivePreviewProps {
    readonly workspaceId: string;
    readonly serverUrl?: string;
}

export function LivePreview({
    workspaceId,
    serverUrl,
}: LivePreviewProps) {
    const [port, setPort] = useState<number>(5173);
    const [path, setPath] = useState<string>("/");
    const [viewport, setViewport] = useState<ViewportMode>("responsive");
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const fullPreviewUrl = `${getExecutionEngineUrl(serverUrl)}/preview/${encodeURIComponent(workspaceId)}/${port}${cleanPath}`;

    const handleRefresh = () => {
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
      {/* Embedded Iframe Container */}
      <div className="flex-1 bg-slate-950/60 flex justify-center items-stretch overflow-hidden p-2">
        <iframe
          ref={iframeRef}
          src={fullPreviewUrl}
          title="Live Web Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          className={`h-full ${viewportWidthClass} bg-white rounded border border-slate-800/80 shadow-2xl transition-all duration-200`}
        />
      </div>
    </div>
  );
}