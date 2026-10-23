import type { Namespace, Socket } from "socket.io";
import type {
    TerminalClientToServerEvents,
    TerminalServerToClientEvents,
    TerminalCreatePayload,
    TerminalDataPayload,
    TerminalResizePayload,
    TerminalKillPayload,
    ExecutionFile,
    SupportedLanguage,
} from "@tessera/shared-types";
import { TerminalRunner } from "./terminalRunner.js";

export type TerminalSocket = Socket<TerminalClientToServerEvents, TerminalServerToClientEvents>;

export type TerminalNamespace = Namespace<TerminalClientToServerEvents, TerminalServerToClientEvents>;

export interface TerminalGatewayOptions {
    readonly runner?: TerminalRunner;
}

const MAX_SESSION_ID_LENGTH = 128;
const MAX_TERMINAL_DATA_BYTES = 512 * 1024; // 512 KB
const MIN_COLS = 1;
const MAX_COLS = 1000;
const MIN_ROWS = 1;
const MAX_ROWS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidIdentifier(val: unknown): val is string {
    return typeof val === "string" && val.trim().length > 0 && val.length <= MAX_SESSION_ID_LENGTH;
}

function isValidInteger(val: unknown, min: number, max: number): val is number {
    return typeof val === "number" && Number.isInteger(val) && val >= min && val <= max;
}

function validateTerminalCreate(payload: unknown): { error?: string; validated?: TerminalCreatePayload } {
    if (!isRecord(payload)) {
        return { error: "Invalid payload: must be a non-null object" };
    }

    if (!isValidIdentifier(payload["roomId"])) {
        return { error: "Invalid payload: roomId must be a non-empty string" };
    }

    const cols = payload["cols"];
    if (cols !== undefined && !isValidInteger(cols, MIN_COLS, MAX_COLS)) {
        return { error: `Invalid payload: cols must be an integer between ${MIN_COLS} and ${MAX_COLS}` };
    }

    const rows = payload["rows"];
    if (rows !== undefined && !isValidInteger(rows, MIN_ROWS, MAX_ROWS)) {
        return { error: `Invalid payload: rows must be an integer between ${MIN_ROWS} and ${MAX_ROWS}` };
    }

    const workspaceId = payload["workspaceId"];
    if (workspaceId !== undefined && !isValidIdentifier(workspaceId)) {
        return { error: "Invalid payload: workspaceId must be a non-empty string" };
    }

    const language = payload["language"];
    if (language !== undefined && (typeof language !== "string" || language.length > 64)) {
        return { error: "Invalid payload: language must be a valid string" };
    }

    const initialFiles = payload["initialFiles"];
    if (initialFiles !== undefined) {
        if (!Array.isArray(initialFiles) || initialFiles.length > 100) {
            return { error: "Invalid payload: initialFiles must be an array of at most 100 files" };
        }
        for (const file of initialFiles) {
            if (!isRecord(file) || typeof file["path"] !== "string" || typeof file["content"] !== "string") {
                return { error: "Invalid payload: initialFiles items must contain string path and content" };
            }
        }
    }

    const validated: TerminalCreatePayload = {
        roomId: payload["roomId"],
        ...(typeof cols === "number" ? { cols } : {}),
        ...(typeof rows === "number" ? { rows } : {}),
        ...(typeof workspaceId === "string" ? { workspaceId } : {}),
        ...(typeof language === "string" ? { language: language as SupportedLanguage } : {}),
        ...(Array.isArray(initialFiles) ? { initialFiles: initialFiles as readonly ExecutionFile[] } : {}),
    };

    return { validated };
}

function validateTerminalData(payload: unknown): {
    error?: string;
    validated?: TerminalDataPayload;
    sessionId?: string;
} {
    if (!isRecord(payload)) {
        return { error: "Invalid payload: must be a non-null object" };
    }

    const sessionId = typeof payload["sessionId"] === "string" && payload["sessionId"].trim().length > 0
        ? payload["sessionId"]
        : undefined;

    if (!isValidIdentifier(payload["sessionId"])) {
        return { error: "Invalid payload: sessionId must be a non-empty string", sessionId };
    }

    if (typeof payload["data"] !== "string") {
        return { error: "Invalid payload: data must be a string", sessionId };
    }

    if (Buffer.byteLength(payload["data"], "utf-8") > MAX_TERMINAL_DATA_BYTES) {
        return { error: "Terminal data payload exceeds maximum allowed size", sessionId };
    }

    return {
        validated: {
            sessionId: payload["sessionId"],
            data: payload["data"],
        },
        sessionId: payload["sessionId"],
    };
}

function validateTerminalResize(payload: unknown): {
    error?: string;
    validated?: TerminalResizePayload;
    sessionId?: string;
} {
    if (!isRecord(payload)) {
        return { error: "Invalid payload: must be a non-null object" };
    }

    const sessionId = typeof payload["sessionId"] === "string" && payload["sessionId"].trim().length > 0
        ? payload["sessionId"]
        : undefined;

    if (!isValidIdentifier(payload["sessionId"])) {
        return { error: "Invalid payload: sessionId must be a non-empty string", sessionId };
    }

    if (!isValidInteger(payload["cols"], MIN_COLS, MAX_COLS)) {
        return { error: `Invalid payload: cols must be an integer between ${MIN_COLS} and ${MAX_COLS}`, sessionId };
    }

    if (!isValidInteger(payload["rows"], MIN_ROWS, MAX_ROWS)) {
        return { error: `Invalid payload: rows must be an integer between ${MIN_ROWS} and ${MAX_ROWS}`, sessionId };
    }

    return {
        validated: {
            sessionId: payload["sessionId"],
            cols: payload["cols"],
            rows: payload["rows"],
        },
        sessionId: payload["sessionId"],
    };
}

function validateTerminalKill(payload: unknown): {
    error?: string;
    validated?: TerminalKillPayload;
    sessionId?: string;
} {
    if (!isRecord(payload)) {
        return { error: "Invalid payload: must be a non-null object" };
    }

    const sessionId = typeof payload["sessionId"] === "string" && payload["sessionId"].trim().length > 0
        ? payload["sessionId"]
        : undefined;

    if (!isValidIdentifier(payload["sessionId"])) {
        return { error: "Invalid payload: sessionId must be a non-empty string", sessionId };
    }

    return {
        validated: {
            sessionId: payload["sessionId"],
        },
        sessionId: payload["sessionId"],
    };
}

export class TerminalGateway {
    private readonly runner: TerminalRunner;
    private readonly socketSessions = new Map<string, Set<string>>();
    private readonly connectedSockets = new Set<string>();

    constructor(options: TerminalGatewayOptions = {}) {
        this.runner = options.runner ?? new TerminalRunner();
    }

    public getRunner(): TerminalRunner {
        return this.runner;
    }

    public getSessionIdsForSocket(socketId: string): ReadonlySet<string> {
        return this.socketSessions.get(socketId) ?? new Set<string>();
    }

    public attach(namespace: TerminalNamespace): void {
        namespace.on("connection", (socket: TerminalSocket) => {
            this.handleConnection(socket);
        });
    }

    public handleConnection(socket: TerminalSocket): void {
        this.connectedSockets.add(socket.id);

        socket.on("terminal:create", async (rawPayload: TerminalCreatePayload) => {
            const { error, validated } = validateTerminalCreate(rawPayload);
            if (error || !validated) {
                socket.emit("terminal:error", {
                    error: error ?? "Invalid terminal:create payload",
                });
                return;
            }

            try {
                const session = await this.runner.createSession(validated, {
                    onData: (data: string) => {
                        socket.emit("terminal:output", {
                            sessionId: session.sessionId,
                            data,
                        });
                    },
                    onExit: (exitCode: number | null) => {
                        socket.emit("terminal:exit", {
                            sessionId: session.sessionId,
                            exitCode,
                        });
                        this.untrackSession(socket.id, session.sessionId);
                    },
                    onFsEvent: (event) => {
                        socket.emit("terminal:fs-event", event);
                    },
                });

                if (!this.connectedSockets.has(socket.id)) {
                    await this.runner.killSession(session.sessionId);
                    return;
                }

                this.trackSession(socket.id, session.sessionId);
                socket.emit("terminal:created", { sessionId: session.sessionId });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                socket.emit("terminal:error", {
                    error: message,
                });
            }
        });

        socket.on("terminal:data", (rawPayload: TerminalDataPayload) => {
            const { error, validated, sessionId } = validateTerminalData(rawPayload);
            if (error || !validated) {
                socket.emit("terminal:error", {
                    sessionId,
                    error: error ?? "Invalid terminal:data payload",
                });
                return;
            }

            try {
                if (!this.isSessionOwnedBySocket(socket.id, validated.sessionId)) {
                    socket.emit("terminal:error", {
                        sessionId: validated.sessionId,
                        error: "Terminal session not found or unauthorized",
                    });
                    return;
                }

                this.runner.write(validated.sessionId, validated.data);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                socket.emit("terminal:error", {
                    sessionId: validated.sessionId,
                    error: message,
                });
            }
        });

        socket.on("terminal:resize", async (rawPayload: TerminalResizePayload) => {
            const { error, validated, sessionId } = validateTerminalResize(rawPayload);
            if (error || !validated) {
                socket.emit("terminal:error", {
                    sessionId,
                    error: error ?? "Invalid terminal:resize payload",
                });
                return;
            }

            try {
                if (!this.isSessionOwnedBySocket(socket.id, validated.sessionId)) {
                    socket.emit("terminal:error", {
                        sessionId: validated.sessionId,
                        error: "Terminal session not found or unauthorized",
                    });
                    return;
                }

                await this.runner.resize(validated.sessionId, validated.cols, validated.rows);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                socket.emit("terminal:error", {
                    sessionId: validated.sessionId,
                    error: message,
                });
            }
        });

        socket.on("terminal:kill", async (rawPayload: TerminalKillPayload) => {
            const { error, validated, sessionId } = validateTerminalKill(rawPayload);
            if (error || !validated) {
                socket.emit("terminal:error", {
                    sessionId,
                    error: error ?? "Invalid terminal:kill payload",
                });
                return;
            }

            try {
                if (!this.isSessionOwnedBySocket(socket.id, validated.sessionId)) {
                    socket.emit("terminal:error", {
                        sessionId: validated.sessionId,
                        error: "Terminal session not found or unauthorized",
                    });
                    return;
                }
                
                await this.runner.killSession(validated.sessionId);
                this.untrackSession(socket.id, validated.sessionId);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                socket.emit("terminal:error", {
                    sessionId: validated.sessionId,
                    error: message,
                });
            }
        });

        socket.on("disconnect", async () => {
            this.connectedSockets.delete(socket.id);
            const sessionIds = this.socketSessions.get(socket.id);
            if (sessionIds) {
                for (const sessionId of Array.from(sessionIds)) {
                    try {
                        await this.runner.killSession(sessionId);
                    } catch {
                        // Ignore errors during socket cleanup
                    }
                }

                this.socketSessions.delete(socket.id);
            }
        });
    }

    private isSessionOwnedBySocket(socketId: string, sessionId: string): boolean {
        const sessions = this.socketSessions.get(socketId);
        return sessions !== undefined && sessions.has(sessionId);
    }

    private trackSession(socketId: string, sessionId: string): void {
        let sessions = this.socketSessions.get(socketId);
        if (!sessions) {
            sessions = new Set<string>();
            this.socketSessions.set(socketId, sessions);
        }
        sessions.add(sessionId);
    }

    private untrackSession(socketId: string, sessionId: string): void {
        const sessions = this.socketSessions.get(socketId);
        if (sessions) {
            sessions.delete(sessionId);
            if (sessions.size === 0) {
                this.socketSessions.delete(socketId);
            }
        }
    }
}
