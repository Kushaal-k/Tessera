import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { io, type Socket } from "socket.io-client";
import type {
  TerminalClientToServerEvents,
  TerminalServerToClientEvents,
} from "@tessera/shared-types";
import "@xterm/xterm/css/xterm.css";

export interface TerminalProps {
  readonly roomId?: string;
  readonly className?: string;
  readonly serverUrl?: string;
}

const TESSERA_TERMINAL_THEME = {
  background: "#0f172a", // slate-900 matching Tessera background
  foreground: "#e2e8f0", // slate-200
  cursor: "#38bdf8",     // sky-400 primary accent
  cursorAccent: "#0f172a",
  selectionBackground: "#334155", // slate-700
  selectionForeground: "#ffffff",
  black: "#0f172a",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  blue: "#38bdf8",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#f8fafc",
  brightBlack: "#475569",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#0ea5e9",
  brightMagenta: "#a855f7",
  brightCyan: "#06b6d4",
  brightWhite: "#ffffff",
};

export function Terminal({ roomId, className, serverUrl }: TerminalProps) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket<
    TerminalServerToClientEvents,
    TerminalClientToServerEvents
  > | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting");

  useEffect(() => {
    const container = terminalContainerRef.current;
    if (!container) {
      return;
    }

    const term = new XTerm({
      theme: TESSERA_TERMINAL_THEME,
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(container);
    try {
      fitAddon.fit();
    } catch {
      // Container may not be sized yet on initial mount
    }

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const targetUrl =
      serverUrl ??
      (import.meta.env["VITE_EXECUTION_ENGINE_URL"] as string | undefined) ??
      "http://localhost:4002";

    const socket: Socket<
      TerminalServerToClientEvents,
      TerminalClientToServerEvents
    > = io(`${targetUrl}/terminal`, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
      socket.emit("terminal:create", {
        roomId: roomId ?? "default-room",
        cols: term.cols,
        rows: term.rows,
      });
    });

    socket.on("terminal:created", ({ sessionId }) => {
      sessionIdRef.current = sessionId;
    });

    socket.on("terminal:output", ({ data }) => {
      term.write(data);
    });

    socket.on("terminal:exit", ({ exitCode }) => {
      term.writeln(
        `\r\n\x1b[33m[Process exited with code ${exitCode ?? "unknown"}]\x1b[0m`
      );
      setStatus("disconnected");
    });

    socket.on("terminal:error", ({ error }) => {
      term.writeln(`\r\n\x1b[31m[Terminal Error: ${error}]\x1b[0m`);
      setStatus("error");
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
    });

    const dataDisposable = term.onData((data) => {
      if (sessionIdRef.current) {
        socket.emit("terminal:data", {
          sessionId: sessionIdRef.current,
          data,
        });
      }
    });

    let resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
      resizeTimeoutId = setTimeout(() => {
        try {
          fitAddon.fit();
          if (sessionIdRef.current && term.cols > 0 && term.rows > 0) {
            socket.emit("terminal:resize", {
              sessionId: sessionIdRef.current,
              cols: term.cols,
              rows: term.rows,
            });
          }
        } catch {
          // Ignore resize errors if container is hidden or detached
        }
      }, 50);
    });

    resizeObserver.observe(container);

    return () => {
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
      resizeObserver.disconnect();
      dataDisposable.dispose();

      if (sessionIdRef.current) {
        socket.emit("terminal:kill", { sessionId: sessionIdRef.current });
      }
      socket.disconnect();
      term.dispose();

      termRef.current = null;
      fitAddonRef.current = null;
      socketRef.current = null;
      sessionIdRef.current = null;
    };
  }, [roomId, serverUrl]);

  return (
    <div
      className={`relative flex flex-col h-full w-full overflow-hidden bg-[#0f172a] ${
        className ?? ""
      }`}
      data-status={status}
    >
      <div
        ref={terminalContainerRef}
        className="flex-1 w-full h-full overflow-hidden p-2"
        data-testid="terminal-container"
      />
    </div>
  );
}
