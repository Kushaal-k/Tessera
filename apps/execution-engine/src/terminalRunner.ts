import { randomUUID } from "node:crypto";
import Dockerode from "dockerode";
import { WorkspaceStorage } from "./workspaceStorage.js";
import { FsWatcher, type FsWatchEvent } from "./fsWatcher.js";
import type { TerminalCreatePayload } from "@tessera/shared-types";

export interface TerminalSessionCallbacks {
    readonly onData: (data: string) => void;
    readonly onExit: (exitCode: number | null) => void;
    readonly onFsEvent?: (event: FsWatchEvent) => void;
}

export interface TerminalSession {
    readonly sessionId: string;
    readonly roomId: string;
    readonly container: Dockerode.Container;
    readonly exec: Dockerode.Exec;
    readonly stream: NodeJS.ReadWriteStream;
    readonly callback: TerminalSessionCallbacks;
    readonly watcher?: FsWatcher;
}

export interface TerminalRunnerOptions {
    readonly docker?: Dockerode;
    readonly workspaceStorage?: WorkspaceStorage;
    readonly defaultImage?: string;
    readonly defaultCols?: number;
    readonly defaultRows?: number;
}

export class TerminalRunner {
    private readonly docker: Dockerode;
    private readonly workspaceStorage: WorkspaceStorage;
    private readonly defaultImage: string;
    private readonly defaultCols: number;
    private readonly defaultRows: number;
    private readonly sessions = new Map<string, TerminalSession>();

    constructor(options: TerminalRunnerOptions = {}) {
        this.docker = options.docker ?? 
            new Dockerode({
                socketPath: process.env["DOCKER_SOCKET_PATH"] ?? "/var/run/docker.sock",
            });
        this.workspaceStorage = options.workspaceStorage ?? new WorkspaceStorage();
        this.defaultImage = options.defaultImage ?? "node:20-slim";
        this.defaultCols = options.defaultCols ?? 80;
        this.defaultRows = options.defaultRows ?? 24;
    }

    public getSession(sessionId: string): TerminalSession | undefined {
        return this.sessions.get(sessionId);
    }

    public getActiveSessionCount(): number {
        return this.sessions.size;
    }

    public async createSession(
        payload: TerminalCreatePayload,
        callbacks: TerminalSessionCallbacks,
    ): Promise<TerminalSession> {
        const sessionId = payload.sessionId ?? randomUUID();
        const cols = payload.cols ?? this.defaultCols;
        const rows = payload.rows ?? this.defaultRows;
        const workspaceId = payload.workspaceId ?? payload.roomId;

        await this.workspaceStorage.initWorkspace(workspaceId, payload.initialFiles);
        const hostWorkspacePath = this.workspaceStorage.getWorkspacePath(workspaceId);

        const container = await this.docker.createContainer({
            Image: this.defaultImage,
            Cmd: ["tail", "-f", "/dev/null"],
            User: "1000",
            WorkingDir: "/workspace",
            Tty: true,
            OpenStdin: true,
            HostConfig: {
                Binds: [`${hostWorkspacePath}:/workspace:rw`],
                CapDrop: ["ALL"],
                SecurityOpt: ["no-new-privileges:true"],
                Memory: 256 * 1024 * 1024,
                CpuQuota: 100000,
                AutoRemove: false,
            },
        });

        await container.start();

        const exec = await container.exec({
            Cmd: ["/bin/sh"],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            User: "1000",
            WorkingDir: "/workspace",
        });

        const stream = await exec.start({
            hijack: true,
            stdin: true,
            Tty: true,
        });

        try {
            await exec.resize({ h: rows, w: cols });
        } catch (error) {
            //Ignore initial resize error if stream is still initializing
        }

        const watcher = new FsWatcher(workspaceId, hostWorkspacePath);
        if (callbacks.onFsEvent) {
            watcher.onEvent(callbacks.onFsEvent);
        }
        watcher.start();

        const session: TerminalSession = {
            sessionId,
            roomId: payload.roomId,
            container,
            exec,
            stream,
            callback: callbacks,
            watcher,
        };

        stream.on("data", (chunk: Buffer | string) => {
            const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
            callbacks.onData(text);
        })

        stream.on("end", async () => {
            let exitCode: number | null = null;

            try {
                const inspectInfo = await exec.inspect();
                if (typeof inspectInfo.ExitCode === "number"){
                    exitCode = inspectInfo.ExitCode;
                }
            } catch {
                // Inspect may fail if container shut down
            }

            await this.killSession(sessionId, exitCode);
        });

        this.sessions.set(sessionId, session);
        return session;
    }

    public write(sessionId: string, data: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Terminal session ${sessionId} not found`);
        }

        session.stream.write(data);
    }

    public async resize(
        sessionId: string,
        cols: number,
        rows: number,
    ): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Terminal session ${sessionId} not found`);
        }

        await session.exec.resize({ h: rows, w: cols });
    }

    public async killSession(
        sessionId: string,
        exitCode: number | null = 0
    ): Promise<void> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            return;
        }

        this.sessions.delete(sessionId);

        if (session.watcher) {
            try {
                await session.watcher.stop();
            } catch {
                // Ignore watcher teardown error
            }
        }

        try {
            session.stream.removeAllListeners();
            if ("destroy" in session.stream && typeof session.stream.destroy === "function") {
                session.stream.destroy();
            }
        } catch {
            // Stream man already be closed
        }

        try {
            await session.container.remove({ force: true });
        } catch {
            // Container may already be removed
        }

        session.callback.onExit(exitCode);
    }

    public async cleanupAll(): Promise<void> {
        const sessionIds = Array.from(this.sessions.keys());
        for (const sessionId of sessionIds) {
            await this.killSession(sessionId, null);
        }
    }

}