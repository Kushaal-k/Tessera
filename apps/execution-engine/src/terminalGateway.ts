import type { Namespace, Socket } from "socket.io";
import type {
    TerminalClientToServerEvents,
    TerminalServerToClientEvents,
    TerminalCreatePayload,
    TerminalDataPayload,
    TerminalResizePayload,
    TerminalKillPayload
} from "@tessera/shared-types";
import { TerminalRunner } from "./terminalRunner.js";

export type TerminalSocket = Socket<TerminalClientToServerEvents, TerminalServerToClientEvents>;

export type TerminalNamespace = Namespace<TerminalClientToServerEvents, TerminalServerToClientEvents>;

export interface TerminalGatewayOptions {
    readonly runner?: TerminalRunner;
}

export class TerminalGateway {
    private readonly runner: TerminalRunner;
    private readonly socketSessions = new Map<string, Set<string>>();

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
        socket.on("terminal:create", async (payload: TerminalCreatePayload) => {
            try {
                const session = await this.runner.createSession(payload, {
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

                this.trackSession(socket.id, session.sessionId);
                socket.emit("terminal:created", { sessionId: session.sessionId });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                socket.emit("terminal:error", {
                    sessionId: payload.sessionId,
                    error: message,
                });
            }
        });

        socket.on("terminal:data", (payload: TerminalDataPayload) => {
            try {
                this.runner.write(payload.sessionId, payload.data);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                socket.emit("terminal:error", {
                    sessionId: payload.sessionId,
                    error: message,
                }); 
            }
        });

        socket.on("terminal:resize", async (payload: TerminalResizePayload) => {
            try {
                await this.runner.resize(payload.sessionId, payload.cols, payload.rows);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                socket.emit("terminal:error", {
                    sessionId: payload.sessionId,
                    error: message,
                });
            }
        });

        socket.on("terminal:kill", async (payload: TerminalKillPayload) => {
            try {
                await this.runner.killSession(payload.sessionId);
                this.untrackSession(socket.id, payload.sessionId);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                socket.emit("terminal:error", {
                    sessionId: payload.sessionId,
                    error: message,
                });
            }
        });

        socket.on("disconnect", async () => {
            const sessionIds = this.socketSessions.get(socket.id);
            if (sessionIds) {
                for (const sessionId of Array.from(sessionIds)) {
                    try {
                        await this.runner.killSession(sessionId);
                    }
                    catch {
                        // Ignore errors
                    }
                }

                this.socketSessions.delete(socket.id);
            }
        });
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