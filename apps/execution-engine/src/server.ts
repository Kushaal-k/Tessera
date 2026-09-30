import http from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { TerminalGateway, type TerminalNamespace } from "./terminalGateway.js";
import { TerminalRunner } from "./terminalRunner.js";

export interface ServerOptions {
    readonly port?: number;
    readonly corsOrigin?: string;
    readonly runner?: TerminalRunner;
}

export interface RunningServer {
    readonly httpServer: http.Server;
    readonly io: SocketIOServer;
    readonly gateway: TerminalGateway;
    readonly port: number;
    readonly stop: () => Promise<void>;
}

export function createServer(options: ServerOptions = {}): RunningServer {
    const port = options.port ?? 
        Number(process.env["TERMINAL_PORT"] ?? process.env["PORT"] ?? 4002);

    const corsOrigin = options.corsOrigin ??
        process.env["CLIENT_ORIGIN"] ??
        "http://localhost:3000";

    const httpServer = http.createServer((req, res) => {
        if (req.url === "/health" && req.method === "GET") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok", service: "execution-engine" }));
            return;
        }
        res.writeHead(404);
        res.end();
    });

    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: corsOrigin,
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    const runner = options.runner ?? new TerminalRunner();
    const gateway = new TerminalGateway({ runner });

    const terminalNamespace = io.of("/terminal") as unknown as TerminalNamespace;

    gateway.attach(terminalNamespace);

    const stop = async (): Promise<void> => {
        await runner.cleanupAll();
        await new Promise<void>((resolve) => {
            io.close(() => {
                httpServer.close(() => {
                    resolve();
                });
            });
        });
    };

    return {
        httpServer,
        io,
        gateway,
        port,
        stop,
    };
}

export async function startServer(options: ServerOptions = {}): Promise<RunningServer> {
    const server = createServer(options);

    await new Promise<void>((resolve, reject) => {
        server.httpServer.once("error", reject);
        server.httpServer.listen(server.port, () => {
            server.httpServer.removeListener("error", reject);
            console.log(
                `[execution-engine] Terminal WebSocket Gateway running on port ${String(server.port)} (/terminal)`
            );
            resolve();
        });
    });

    return server;
}