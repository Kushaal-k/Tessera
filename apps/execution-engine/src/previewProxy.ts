import { createHash } from "node:crypto";
import http from "node:http";
import net from "node:net";
import type { TerminalRunner } from "./terminalRunner.js";

export interface PreviewRouteParams {
    readonly workspaceId: string;
    readonly port: number;
    readonly targetPath: string;
}

export class PreviewProxy {
    constructor(
        private readonly runner: TerminalRunner,
        private readonly previewBaseUrl = process.env["PREVIEW_BASE_URL"],
    ) {}

    public parsePreviewUrl(url?: string): PreviewRouteParams | null {
        const match = url?.match(/^\/preview\/([a-zA-Z0-9_-]+)\/(\d+)(?:([/?#].*))?$/);
        if (!match?.[1] || !match[2]) {
            return null;
        }

        const port = Number(match[2]);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            return null;
        }

        const subPath = match[3] ?? "/";
        return {
            workspaceId: match[1],
            port,
            targetPath: subPath.startsWith("/") ? subPath : `/${subPath}`,
        };
    }

    public isPreviewRequest(req: http.IncomingMessage): boolean {
        return this.isPreviewHost(req) || Boolean(req.url?.startsWith("/preview/"));
    }

    public resolveRoute(req: http.IncomingMessage): PreviewRouteParams | null {
        if (this.isPreviewHost(req)) {
            const target = this.parsePreviewHost(req);
            if (!target) {
                return null;
            }
            for (const workspaceId of this.runner.getWorkspaceIds()) {
                if (this.workspaceToken(workspaceId) === target.workspaceToken) {
                    return { workspaceId, port: target.port, targetPath: req.url ?? "/" };
                }
            }
            return null;
        }

        return this.parsePreviewUrl(req.url);
    }

    public async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            const route = this.resolveRoute(req);
            if (!route) {
                if (this.parsePreviewHost(req)) {
                    this.renderDiagnosticPage(res, 404, "Workspace Container Not Found",
                        "No active container session exists for this workspace. Open a terminal session to start the container.");
                } else {
                    res.writeHead(400, { "content-type": "text/plain" });
                    res.end("Invalid preview URL format. Expected /preview/:workspaceId/:port/*");
                }
                return;
            }

            if (!this.isPreviewHost(req)) {
                this.redirectToPreview(req, res, route);
                return;
            }

            const containerIp = await this.runner.getWorkspaceContainerIp(route.workspaceId, route.port);
            if (!containerIp) {
                this.renderDiagnosticPage(res, 404, "Workspace Container Not Found",
                    "No active container session exists for this workspace. Open a terminal session to start the container.");
                return;
            }
            if (res.destroyed) {
                return;
            }

            const proxyReq = http.request({
                hostname: containerIp,
                port: route.port,
                path: route.targetPath,
                method: req.method,
                headers: {
                    ...req.headers,
                    host: `${containerIp}:${String(route.port)}`,
                    "x-forwarded-host": req.headers.host ?? "",
                    "x-forwarded-proto": this.requestProtocol(req),
                    "x-forwarded-prefix": "",
                },
            }, (proxyRes) => {
                res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
                proxyRes.on("error", () => res.destroy());
                proxyRes.pipe(res);
            });

            proxyReq.on("error", (error: NodeJS.ErrnoException) => {
                const notListening = ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(error.code ?? "");
                this.renderDiagnosticPage(
                    res, 502,
                    notListening ? "Server Not Yet Listening" : "Proxy Error",
                    notListening
                        ? `Port ${String(route.port)} inside the container is not accepting connections yet. Start your development server (e.g. npm run dev -- --host 0.0.0.0) in the terminal.`
                        : `Failed to forward request: ${error.message}`,
                );
            });
            proxyReq.setTimeout(10_000, () => {
                proxyReq.destroy(Object.assign(new Error("Preview server timed out"), { code: "ETIMEDOUT" }));
            });
            req.on("aborted", () => proxyReq.destroy());
            res.on("close", () => {
                if (!res.writableFinished) {
                    proxyReq.destroy();
                }
            });
            req.pipe(proxyReq);
        } catch (error) {
            this.renderDiagnosticPage(res, 502, "Proxy Error",
                error instanceof Error ? error.message : "Failed to forward preview request.");
        }
    }

    public async handleUpgrade(req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer): Promise<void> {
        try {
            const route = this.resolveRoute(req);
            if (!route) {
                clientSocket.destroy();
                return;
            }

            const containerIp = await this.runner.getWorkspaceContainerIp(route.workspaceId, route.port);
            if (!containerIp || clientSocket.destroyed) {
                clientSocket.destroy();
                return;
            }

            const targetSocket = net.connect(route.port, containerIp, () => {
                targetSocket.setTimeout(0);
                const headers = {
                    ...req.headers,
                    host: `${containerIp}:${String(route.port)}`,
                    "x-forwarded-host": req.headers.host ?? "",
                    "x-forwarded-proto": this.requestProtocol(req),
                };
                targetSocket.write(
                    `${req.method ?? "GET"} ${route.targetPath} HTTP/${req.httpVersion}\r\n` +
                    Object.entries(headers)
                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : (value ?? "")}\r\n`)
                        .join("") + "\r\n",
                );
                if (head.length > 0) {
                    targetSocket.write(head);
                }
                targetSocket.pipe(clientSocket);
                clientSocket.pipe(targetSocket);
            });

            targetSocket.setTimeout(3_000, () => targetSocket.destroy());
            targetSocket.on("error", () => clientSocket.destroy());
            targetSocket.on("close", () => clientSocket.destroy());
            clientSocket.on("error", () => targetSocket.destroy());
            clientSocket.on("close", () => targetSocket.destroy());
        } catch {
            clientSocket.destroy();
        }
    }

    private hostname(req: http.IncomingMessage): string {
        try {
            return new URL(`http://${req.headers.host ?? ""}`).hostname;
        } catch {
            return "";
        }
    }

    private isPreviewHost(req: http.IncomingMessage): boolean {
        return /^[^.]+\.preview\./.test(this.hostname(req));
    }

    private parsePreviewHost(req: http.IncomingMessage): { workspaceToken: string; port: number } | null {
        const match = this.hostname(req).match(/^p(\d+)-([a-f0-9]{32})\.preview\./);
        const port = Number(match?.[1]);
        if (!match?.[2] || !Number.isInteger(port) || port < 1 || port > 65535) {
            return null;
        }
        return { workspaceToken: match[2], port };
    }

    private workspaceToken(workspaceId: string): string {
        return createHash("sha256").update(workspaceId).digest("hex").slice(0, 32);
    }

    private requestProtocol(req: http.IncomingMessage): "http" | "https" {
        return req.headers["x-forwarded-proto"] === "https" ||
            (req.socket as net.Socket & { encrypted?: boolean })?.encrypted ? "https" : "http";
    }

    private redirectToPreview(req: http.IncomingMessage, res: http.ServerResponse, route: PreviewRouteParams): void {
        const base = new URL(this.previewBaseUrl ?? `${this.requestProtocol(req)}://${req.headers.host ?? "localhost:4002"}`);
        if (["127.0.0.1", "[::1]"].includes(base.hostname)) {
            base.hostname = "localhost";
        }
        if (net.isIP(base.hostname) || base.hostname.startsWith("[")) {
            throw new Error("Preview requires a DNS hostname. Configure PREVIEW_BASE_URL with your preview domain.");
        }
        base.hostname = `p${String(route.port)}-${this.workspaceToken(route.workspaceId)}.preview.${base.hostname}`;
        res.writeHead(307, { Location: `${base.origin}${route.targetPath}`, "Cache-Control": "no-store" });
        res.end();
    }

    private renderDiagnosticPage(
        res: http.ServerResponse,
        statusCode: number,
        title: string,
        message: string,
    ): void {
        if (res.destroyed || res.writableEnded) {
            return;
        }
        if (res.headersSent) {
            res.destroy();
            return;
        }
        const escapeHtml = (value: string): string => value
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        title = escapeHtml(title);
        message = escapeHtml(message);
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