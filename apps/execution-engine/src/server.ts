import http from "node:http";
import type net from "node:net";
import { Server as SocketIOServer } from "socket.io";
import { PreviewProxy } from "./previewProxy.js";
import { TerminalGateway, type TerminalNamespace } from "./terminalGateway.js";
import { TerminalRunner } from "./terminalRunner.js";

export interface ServerOptions {
    readonly port?: number;
    readonly corsOrigin?: string;
    readonly runner?: TerminalRunner;
    readonly previewBaseUrl?: string;
}

export interface RunningServer {
    readonly httpServer: http.Server;
    readonly io: SocketIOServer;
    readonly gateway: TerminalGateway;
    readonly previewProxy: PreviewProxy;
    readonly port: number;
    readonly stop: () => Promise<void>;
}

export function createServer(options: ServerOptions = {}): RunningServer {
    const port = options.port ??
        Number(process.env["TERMINAL_PORT"] ?? process.env["PORT"] ?? 4002);
    const corsOrigin = options.corsOrigin ??
        process.env["CLIENT_ORIGIN"] ?? "http://localhost:3000";
    const runner = options.runner ?? new TerminalRunner({
        enableSyncBridge: true,
        syncServerUrl: process.env["SYNC_SERVER_URL"] ?? "http://localhost:4000",
    });
    const previewProxy = new PreviewProxy(runner, options.previewBaseUrl);
    const httpServer = http.createServer();
    const io = new SocketIOServer(httpServer, {
        cors: { origin: corsOrigin, methods: ["GET", "POST"], credentials: true },
    });

    // Dispatch by preview origin before Socket.IO claims an application's /socket.io/ path.
    const socketIoRequests = httpServer.listeners("request");
    const socketIoUpgrades = httpServer.listeners("upgrade");
    httpServer.removeAllListeners("request");
    httpServer.removeAllListeners("upgrade");

    httpServer.on("request", (req: http.IncomingMessage, res: http.ServerResponse) => {
        if (previewProxy.isPreviewRequest(req)) {
            void previewProxy.handleHttpRequest(req, res);
            return;
        }
        if (req.url === "/health" && req.method === "GET") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok", service: "execution-engine" }));
            return;
        }
        if (req.url?.startsWith("/socket.io/")) {
            for (const handler of socketIoRequests) {
                handler.call(httpServer, req, res);
            }
            return;
        }
        res.writeHead(404);
        res.end();
    });

    httpServer.on("upgrade", (req, socket, head) => {
        if (previewProxy.isPreviewRequest(req)) {
            void previewProxy.handleUpgrade(req, socket as net.Socket, head);
            return;
        }
        if (req.url?.startsWith("/socket.io/")) {
            for (const handler of socketIoUpgrades) {
                handler.call(httpServer, req, socket, head);
            }
            return;
        }
        socket.destroy();
    });

    const gateway = new TerminalGateway({ runner });
    gateway.attach(io.of("/terminal") as unknown as TerminalNamespace);

    const stop = async (): Promise<void> => {
        await runner.cleanupAll();
        await new Promise<void>((resolve) => {
            io.close(() => {
                httpServer.close(() => resolve());
            });
        });
    };

    return { httpServer, io, gateway, previewProxy, port, stop };
}

export async function startServer(options: ServerOptions = {}): Promise<RunningServer> {
    const server = createServer(options);
    await new Promise<void>((resolve, reject) => {
        server.httpServer.once("error", reject);
        server.httpServer.listen(server.port, () => {
            server.httpServer.removeListener("error", reject);
            console.log(
                `[execution-engine] Terminal WebSocket Gateway running on port ${String(server.port)} (/terminal)`,
            );
            resolve();
        });
    });
    return server;
}
