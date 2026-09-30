import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { io, type Socket } from "socket.io-client";
import type {
  TerminalClientToServerEvents,
  TerminalServerToClientEvents,
} from "@tessera/shared-types";
import { TESSERA_TERMINAL_THEME } from "../components/Terminal.js";

export type TerminalStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "terminated";

export interface UseTerminalOptions {
  readonly roomId?: string;
  readonly serverUrl?: string;
}

export interface UseTerminalReturn {
  readonly terminalRef: React.RefObject<HTMLDivElement | null>;
  readonly status: TerminalStatus;
  readonly sessionId: string | null;
  readonly restartTerminal: () => void;
  readonly clearBuffer: () => void;
  readonly copyOutput: () => Promise<boolean>;
}

export function useTerminal({
  roomId,
  serverUrl,
}: UseTerminalOptions = {}): UseTerminalReturn {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket<
    TerminalServerToClientEvents,
    TerminalClientToServerEvents
  > | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [status, setStatus] = useState<TerminalStatus>("connecting");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [restartCount, setRestartCount] = useState<number>(0);

  const clearBuffer = useCallback((): void => {
    if (termRef.current) {
      termRef.current.clear();
    }
  }, []);

  const copyOutput = useCallback(async (): Promise<boolean> => {
    if (!termRef.current) {
      return false;
    }
    const selection = termRef.current.getSelection();
    let textToCopy = selection;

    if (!textToCopy) {
      const buffer = termRef.current.buffer.active;
      const lines: string[] = [];
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          lines.push(line.translateToString(true));
        }
      }
      textToCopy = lines.join("\n");
    }

    if (!textToCopy) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      return true;
    } catch {
      return false;
    }
  }, []);

  const restartTerminal = useCallback((): void => {
    setRestartCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const container = terminalRef.current;
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
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
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

    socket.on("terminal:created", (payload) => {
      sessionIdRef.current = payload.sessionId;
      setSessionId(payload.sessionId);
    });

    socket.on("terminal:output", ({ data }) => {
      term.write(data);
    });

    socket.on("terminal:exit", ({ exitCode }) => {
      term.writeln(
        `\r\n\x1b[33m[Process exited with code ${exitCode ?? "unknown"}]\x1b[0m`
      );
      setStatus("terminated");
    });

    socket.on("terminal:error", ({ error }) => {
      term.writeln(`\r\n\x1b[31m[Terminal Error: ${error}]\x1b[0m`);
      setStatus("disconnected");
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
  }, [roomId, serverUrl, restartCount]);

  return {
    terminalRef,
    status,
    sessionId,
    restartTerminal,
    clearBuffer,
    copyOutput,
  };
}
