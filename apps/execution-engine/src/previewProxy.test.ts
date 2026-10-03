import http from "node:http";
import net from "node:net";
import { describe, expect, it, vi } from "vitest";
import { PreviewProxy } from "./previewProxy.js";
import type { TerminalRunner } from "./terminalRunner.js";

describe("PreviewProxy", () => {
    describe("parsePreviewUrl", () => {
        const proxy = new PreviewProxy({} as unknown as TerminalRunner);

        it("parses valid preview URL with subpath", () => {
            const parsed = proxy.parsePreviewUrl("/preview/workspace-123/5173/src/App.tsx?v=1");
            expect(parsed).toEqual({
                workspaceId: "workspace-123",
                port: 5173,
                targetPath: "/src/App.tsx?v=1",
            });
        });

        it("defaults targetPath to '/' when subpath is omitted", () => {
            const parsed = proxy.parsePreviewUrl("/preview/workspace-123/3000");
            expect(parsed).toEqual({
                workspaceId: "workspace-123",
                port: 3000,
                targetPath: "/",
            });
        });

        it("handles trailing slash as '/'", () => {
            const parsed = proxy.parsePreviewUrl("/preview/ws-abc/8080/");
            expect(parsed).toEqual({
                workspaceId: "ws-abc",
                port: 8080,
                targetPath: "/",
            });
        });

        it("returns null for non-preview URLs", () => {
            expect(proxy.parsePreviewUrl("/health")).toBeNull();
            expect(proxy.parsePreviewUrl("")).toBeNull();
            expect(proxy.parsePreviewUrl(undefined)).toBeNull();
        });

        it("returns null for invalid or out-of-range ports", () => {
            expect(proxy.parsePreviewUrl("/preview/ws-1/not-a-port")).toBeNull();
            expect(proxy.parsePreviewUrl("/preview/ws-1/0")).toBeNull();
            expect(proxy.parsePreviewUrl("/preview/ws-1/70000")).toBeNull();
        });
    });

    describe("handleHttpRequest", () => {
        it("returns 400 for malformed preview URLs", async () => {
            const runner = {
                getWorkspaceContainerIp: vi.fn(),
            } as unknown as TerminalRunner;

            const proxy = new PreviewProxy(runner);

            const req = {
                url: "/preview/invalid",
                method: "GET",
                headers: {},
                pipe: vi.fn(),
            } as unknown as http.IncomingMessage;

            const res = {
                writeHead: vi.fn(),
                end: vi.fn(),
            } as unknown as http.ServerResponse;

            await proxy.handleHttpRequest(req, res);

            expect(res.writeHead).toHaveBeenCalledWith(400, { "content-type": "text/plain" });
            expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Invalid preview URL"));
        });

        it("renders 404 diagnostic page when container is not found", async () => {
            const runner = {
                getWorkspaceContainerIp: vi.fn().mockResolvedValue(null),
            } as unknown as TerminalRunner;

            const proxy = new PreviewProxy(runner);

            const req = {
                url: "/preview/workspace-missing/5173",
                method: "GET",
                headers: {},
                pipe: vi.fn(),
            } as unknown as http.IncomingMessage;

            const res = {
                writeHead: vi.fn(),
                end: vi.fn(),
            } as unknown as http.ServerResponse;

            await proxy.handleHttpRequest(req, res);

            expect(runner.getWorkspaceContainerIp).toHaveBeenCalledWith("workspace-missing");
            expect(res.writeHead).toHaveBeenCalledWith(404, { "Content-Type": "text/html; charset=utf-8" });
            expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Workspace Container Not Found"));
        });

        it("renders 502 diagnostic page when target port is not listening", async () => {
            // Spin up a server and close it so the port is definitely not listening
            const dummyServer = net.createServer();
            await new Promise<void>((resolve) => dummyServer.listen(0, "127.0.0.1", resolve));
            const port = (dummyServer.address() as net.AddressInfo).port;
            await new Promise<void>((resolve) => dummyServer.close(() => resolve()));

            const runner = {
                getWorkspaceContainerIp: vi.fn().mockResolvedValue("127.0.0.1"),
            } as unknown as TerminalRunner;

            const proxy = new PreviewProxy(runner);

            const req = new http.IncomingMessage({} as unknown as net.Socket);
            req.url = `/preview/ws-1/${port}/`;
            req.method = "GET";

            const res = {
                writeHead: vi.fn(),
                end: vi.fn(),
            } as unknown as http.ServerResponse;

            await proxy.handleHttpRequest(req, res);

            // Wait for ECONNREFUSED error handler
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(res.writeHead).toHaveBeenCalledWith(502, { "Content-Type": "text/html; charset=utf-8" });
            expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Server Not Yet Listening"));
        });

        it("proxies request to active container server", async () => {
            // Spin up a real mock HTTP server inside localhost to test end-to-end proxying
            const mockTarget = http.createServer((targetReq, targetRes) => {
                targetRes.writeHead(200, { "Content-Type": "application/json" });
                targetRes.end(JSON.stringify({
                    url: targetReq.url,
                    forwardedHost: targetReq.headers["x-forwarded-host"],
                    prefix: targetReq.headers["x-forwarded-prefix"],
                }));
            });

            await new Promise<void>((resolve) => mockTarget.listen(0, "127.0.0.1", resolve));
            const port = (mockTarget.address() as net.AddressInfo).port;

            try {
                const runner = {
                    getWorkspaceContainerIp: vi.fn().mockResolvedValue("127.0.0.1"),
                } as unknown as TerminalRunner;

                const proxy = new PreviewProxy(runner);

                // Use execution engine createServer to test over HTTP
                const testServer = http.createServer((req, res) => {
                    void proxy.handleHttpRequest(req, res);
                });
                await new Promise<void>((resolve) => testServer.listen(0, "127.0.0.1", resolve));
                const proxyPort = (testServer.address() as net.AddressInfo).port;

                try {
                    const response = await fetch(`http://127.0.0.1:${proxyPort}/preview/ws-real/${port}/test-path?param=42`);
                    const data = await response.json() as {
                        url: string;
                        forwardedHost: string;
                        prefix: string;
                    };

                    expect(response.status).toBe(200);
                    expect(data.url).toBe("/test-path?param=42");
                    expect(data.prefix).toBe(`/preview/ws-real/${port}`);
                } finally {
                    await new Promise<void>((resolve) => testServer.close(() => resolve()));
                }
            } finally {
                await new Promise<void>((resolve) => mockTarget.close(() => resolve()));
            }
        });
    });

    describe("handleUpgrade", () => {
        it("destroys client socket on invalid URL", async () => {
            const runner = {
                getWorkspaceContainerIp: vi.fn(),
            } as unknown as TerminalRunner;

            const proxy = new PreviewProxy(runner);

            const socket = {
                destroy: vi.fn(),
            } as unknown as net.Socket;

            const req = {
                url: "/preview/bad",
            } as unknown as http.IncomingMessage;

            await proxy.handleUpgrade(req, socket, Buffer.alloc(0));
            expect(socket.destroy).toHaveBeenCalled();
        });

        it("destroys client socket when container is not found", async () => {
            const runner = {
                getWorkspaceContainerIp: vi.fn().mockResolvedValue(null),
            } as unknown as TerminalRunner;

            const proxy = new PreviewProxy(runner);

            const socket = {
                destroy: vi.fn(),
            } as unknown as net.Socket;

            const req = {
                url: "/preview/ws-missing/5173",
            } as unknown as http.IncomingMessage;

            await proxy.handleUpgrade(req, socket, Buffer.alloc(0));
            expect(socket.destroy).toHaveBeenCalled();
        });
    });
});
