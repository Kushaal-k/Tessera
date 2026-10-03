import http from "node:http";
import net from "node:net";
import type { TerminalRunner } from "./terminalRunner.js";

export interface PreviewRouteParams {
    readonly workspaceId: string;
    readonly port: number;
    readonly targetPath: string;
}

export class PreviewProxy {
    private readonly runner: TerminalRunner;

    constructor(runner: TerminalRunner) {
        this.runner = runner;
    }

    public parsePreviewUrl(url?: string): PreviewRouteParams | null {
        if (!url) {
            return null;
        }

        // Regex breakdown:
        // ^/preview/           -> starts with /preview/
        // ([^/?#]+)            -> group 1: workspaceId (any chars except '/', '?', '#')
        // /                    -> slash separator
        // (\d+)                -> group 2: port (one or more digits)
        // (?:[/?#](.*))?$      -> optional group 3: query, hash, or trailing subpath

        const match = url.match(/^\/preview\/([^/?#]+)\/(\d+)(?:([/?#].*))?$/);
        if (!match) {
            return null;
        }

        const workspaceId = match[1];
        const portStr = match[2];
        const subPath = match[3];

        if (!workspaceId || !portStr) {
            return null;
        }

        const port = Number.parseInt(portStr, 10);

        if (Number.isNaN(port) || port < 1 || port > 65535) {
            return null;
        }

        let targetPath = "/";
        if (subPath) {
            targetPath = subPath.startsWith("/") ? subPath : `/${subPath}`;
        }

        return {
            workspaceId,
            port,
            targetPath,
        }
    };

    public async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const route = this.parsePreviewUrl(req.url);

        if(!route) {
            res.writeHead(400, { "content-type": "text/plain" });
            res.end("Invalid preview URL format. Expected /preview/:workspaceId/:port/*");
            return;
        }

        const containerIp = await this.runner.getWorkspaceContainerIp(route.workspaceId);
        if(!containerIp) {
            this.renderDiagnosticPage(
                res,
                404,
                "Workspace Container Not Found",
                "No active container session exists for this workspace. Open a terminal session to start the container."
            );
            return;
        }

        const proxyReq = http.request(
            {
                hostname: containerIp,
                port: route.port,
                path: route.targetPath,
                method: req.method,
                headers: {
                    ...req.headers,
                    host: `${containerIp}:${String(route.port)}`,
                    "x-forwarded-host": req.headers.host ?? "",
                    "x-forwarded-proto": "http",
                    "x-forwarded-prefix": `/preview/${route.workspaceId}/${String(route.port)}`,
                },
            },
            (proxeRes) => {
                res.writeHead(proxeRes.statusCode ?? 200, proxeRes.headers);
                proxeRes.pipe(res);
            }
        );

        proxyReq.on("error", (error: NodeJS.ErrnoException) => {
            if (error.code === "ECONNREFUSED" || error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
                this.renderDiagnosticPage(
                    res,
                    502,
                    "Server Not Yet Listening",
                    `Port ${String(route.port)} inside the container is not accepting connections yet. Start your development server (e.g. npm run dev) in the terminal.`
                );
            } else {
                this.renderDiagnosticPage(
                    res,
                    502,
                    "Proxy Error",
                    `Failed to forward request: ${error.message}`
                );
            }
        });

        req.pipe(proxyReq);
    }

    public async handleUpgrade(
        req: http.IncomingMessage,
        clientSocket: net.Socket,
        head: Buffer
    ): Promise<void> {
        const route = this.parsePreviewUrl(req.url);
        if (!route) {
            clientSocket.destroy();
            return;
        }

        const containerIp = await this.runner.getWorkspaceContainerIp(route.workspaceId);
        if (!containerIp) {
            clientSocket.destroy();
            return;
        }

        const targetSocket = net.connect(route.port, containerIp, () => {
            targetSocket.write(
                `${req.method ?? "GET"} ${route.targetPath} HTTP/${req.httpVersion}\r\n` +
                Object.entries(req.headers)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : (v ?? "")}\r\n`)
                    .join("") +
                "\r\n"
            );

            if (head.length > 0) {
                targetSocket.write(head);
            }

            targetSocket.pipe(clientSocket);
            clientSocket.pipe(targetSocket);
        });

        targetSocket.on("error", () => {
            clientSocket.destroy();
        });

        clientSocket.on("error", () => {
            targetSocket.destroy();
        });
    }

    private renderDiagnosticPage(
        res: http.ServerResponse,
        statusCode: number,
        title: string,
        message: string,
    ): void {
        res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <meta http-equiv="refresh" content="3">
                    <title>${title}</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                            background: #0b1120;
                            color: #94a3b8;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                            padding: 1rem;
                            box-sizing: border-box;
                        }
                        .card {
                            background: #1e293b;
                            padding: 2rem;
                            border-radius: 0.75rem;
                            border: 1px solid #334155;
                            max-width: 480px;
                            width: 100%;
                            text-align: center;
                            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
                        }
                        h2 {
                            color: #f8fafc;
                            margin-top: 0;
                            font-size: 1.25rem;
                            margin-bottom: 0.75rem;
                        }
                        p {
                            font-size: 0.875rem;
                            line-height: 1.6;
                            margin-bottom: 1.5rem;
                        }
                        .badge {
                            display: inline-block;
                            font-size: 0.75rem;
                            padding: 0.25rem 0.5rem;
                            border-radius: 9999px;
                            background: #334155;
                            color: #cbd5e1;
                            margin-bottom: 1rem;
                            font-family: monospace;
                        }
                        .btn {
                            background: #38bdf8;
                            color: #0b1120;
                            border: none;
                            padding: 0.5rem 1.25rem;
                            border-radius: 0.375rem;
                            font-size: 0.875rem;
                            font-weight: 600;
                            cursor: pointer;
                            transition: background 0.15s;
                        }
                        .btn:hover {
                            background: #7dd3fc;
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="badge">${String(statusCode)} Diagnostic</div>
                        <h2>${title}</h2>
                        <p>${message}</p>
                        <button class="btn" onclick="location.reload()">Retry Now</button>
                    </div>
                </body>
            </html>`
        );
    }
}