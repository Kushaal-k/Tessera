import http from "node:http";
import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { PreviewProxy } from "./previewProxy.js";
import { createServer, type RunningServer } from "./server.js";
import type { TerminalRunner } from "./terminalRunner.js";

const sockets = new Set<net.Socket>();
const targets: http.Server[] = [];
const engines: RunningServer[] = [];
const clients: Socket[] = [];

afterEach(async () => {
    for (const client of clients.splice(0)) {
        client.disconnect();
    }
    for (const socket of sockets) {
        socket.destroy();
    }
    sockets.clear();
    await Promise.all(engines.splice(0).map((engine) => engine.stop()));
    await Promise.all(targets.splice(0).map((server) =>
        new Promise<void>((resolve) => server.close(() => resolve()))));
});

function mockRunner(workspaces = ["ws-a", "ws-b"]) {
    return {
        getWorkspaceIds: vi.fn(() => workspaces),
        getWorkspaceContainerIp: vi.fn(async () => "127.0.0.1" as string | null),
        cleanupAll: vi.fn(async () => {}),
        killSession: vi.fn(async () => {}),
    };
}

async function listen(server: http.Server): Promise<number> {
    server.on("connection", (socket) => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return (server.address() as net.AddressInfo).port;
}

async function target(handler: http.RequestListener): Promise<{ server: http.Server; port: number }> {
    const server = http.createServer(handler);
    targets.push(server);
    return { server, port: await listen(server) };
}

async function engine(runner = mockRunner(), previewBaseUrl?: string) {
    const server = createServer({ port: 0, runner: runner as unknown as TerminalRunner, previewBaseUrl });
    engines.push(server);
    const port = await listen(server.httpServer);
    return { server, port, base: `http://127.0.0.1:${String(port)}` };
}

async function previewHost(base: string, workspaceId: string, port: number, path = "/"): Promise<string> {
    const response = await fetch(`${base}/preview/${workspaceId}/${String(port)}${path}`, { redirect: "manual" });
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname + location.search).toBe(path);
    return location.host;
}

function request(base: string, host: string, path = "/", headers: Record<string, string> = {}): Promise<Response> {
    return new Promise((resolve, reject) => {
        http.get(base + path, { headers: { ...headers, host } }, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(chunk));
            res.on("error", reject);
            res.on("end", () => {
                const responseHeaders = new Headers();
                for (let index = 0; index < res.rawHeaders.length; index += 2) {
                    const name = res.rawHeaders[index];
                    const value = res.rawHeaders[index + 1];
                    if (name && value) {
                        responseHeaders.append(name, value);
                    }
                }
                resolve(new Response(Buffer.concat(chunks).toString(), {
                    status: res.statusCode ?? 500, headers: responseHeaders,
                }));
            });
        }).on("error", reject);
    });
}

describe("preview URL parsing", () => {
    const proxy = new PreviewProxy({} as TerminalRunner);

    it("preserves subpaths and query strings", () => {
        expect(proxy.parsePreviewUrl("/preview/workspace-123/5173/src/App.tsx?v=1")).toEqual({
            workspaceId: "workspace-123", port: 5173, targetPath: "/src/App.tsx?v=1",
        });
        expect(proxy.parsePreviewUrl("/preview/ws-a/3000?x=1")?.targetPath).toBe("/?x=1");
    });

    it("defaults an omitted or trailing subpath to root", () => {
        expect(proxy.parsePreviewUrl("/preview/ws-a/3000")?.targetPath).toBe("/");
        expect(proxy.parsePreviewUrl("/preview/ws-a/3000/")?.targetPath).toBe("/");
    });

    it.each([undefined, "", "/health", "/preview/ws/a/5173", "/preview/ws-a/not-a-port",
        "/preview/ws-a/0", "/preview/ws-a/70000", "/preview/ws-a/5173junk"])(
        "rejects malformed preview URL %s", (url) => {
            expect(proxy.parsePreviewUrl(url)).toBeNull();
        },
    );

    it("does not route root requests from a cookie or Referer", () => {
        const req = {
            url: "/socket.io/?EIO=4&transport=websocket",
            headers: { host: "localhost:4002", cookie: "tessera_preview_context=ws-a:70000",
                referer: "http://localhost:4002/preview/ws-a/5173/" },
        } as http.IncomingMessage;
        expect(proxy.resolveRoute(req)).toBeNull();
        expect(proxy.isPreviewRequest(req)).toBe(false);
    });
});

describe("preview HTTP routing", () => {
    it("redirects to a stable workspace-and-port origin on the configured preview domain", async () => {
        const { base } = await engine(mockRunner(), "https://engine.example.com");
        const a = await previewHost(base, "ws-a", 5173, "/api/health?x=1");
        const same = await previewHost(base, "ws-a", 5173);
        const otherWorkspace = await previewHost(base, "ws-b", 5173);
        const otherPort = await previewHost(base, "ws-a", 3000);
        expect(a).toBe(same);
        expect(a).toMatch(/^p5173-[a-f0-9]{32}\.preview\.engine\.example\.com$/);
        expect(new Set([a, otherWorkspace, otherPort]).size).toBe(3);
    });

    it("returns diagnostics before a workspace starts and serves the same origin once it starts", async () => {
        const upstream = await target((_req, res) => res.end("ready"));
        const runner = mockRunner([]);
        const { base } = await engine(runner);
        const host = await previewHost(base, "ws-a", upstream.port);
        const missing = await request(base, host);
        expect(missing.status).toBe(404);
        expect(await missing.text()).toContain("Workspace Container Not Found");
        runner.getWorkspaceIds.mockReturnValue(["ws-a"]);
        const ready = await request(base, host);
        expect(ready.status).toBe(200);
        expect(await ready.text()).toBe("ready");
    });

    it("keeps nested assets and application health routes isolated across simultaneous previews", async () => {
        const a = await target((req, res) => res.end("A:" + req.url));
        const b = await target((req, res) => res.end("B:" + req.url));
        const runner = mockRunner();
        const { base } = await engine(runner);
        const hostA = await previewHost(base, "ws-a", a.port);
        const hostB = await previewHost(base, "ws-b", b.port);
        for (const asset of ["/src/shared.js?v=42", "/health", "/socket.io/?transport=polling"]) {
            const responseA = await request(base, hostA, asset, { cookie: `tessera_preview_context=ws-b:${b.port}` });
            const responseB = await request(base, hostB, asset);
            expect(await responseA.text()).toBe("A:" + asset);
            expect(await responseB.text()).toBe("B:" + asset);
        }
        expect(runner.getWorkspaceContainerIp).toHaveBeenCalledWith("ws-a", a.port);
        expect(runner.getWorkspaceContainerIp).toHaveBeenCalledWith("ws-b", b.port);
    });

    it("preserves request headers and all upstream session cookies", async () => {
        const upstream = await target((req, res) => {
            res.setHeader("Set-Cookie", ["session=app-session; Path=/", "theme=dark; Path=/"]);
            res.end(JSON.stringify({ url: req.url, host: req.headers.host,
                forwardedHost: req.headers["x-forwarded-host"], prefix: req.headers["x-forwarded-prefix"],
                cookie: req.headers.cookie }));
        });
        const { base } = await engine();
        const host = await previewHost(base, "ws-a", upstream.port);
        const response = await request(base, host, "/api?value=42", { cookie: "session=app-session" });
        expect(response.headers.getSetCookie()).toEqual(["session=app-session; Path=/", "theme=dark; Path=/"]);
        expect(await response.json()).toEqual({
            url: "/api?value=42", host: `127.0.0.1:${upstream.port}`,
            forwardedHost: host, prefix: "", cookie: "session=app-session",
        });
        const nestedAsset = await request(base, host, "/src/entry.js");
        expect(nestedAsset.status).toBe(200);
        await nestedAsset.text();
    });

    it("rejects invalid ports and ignores malformed old cookies without taking down the engine", async () => {
        const runner = mockRunner();
        const { base } = await engine(runner);
        const malformed = await fetch(base + "/preview/ws-a/70000");
        expect(malformed.status).toBe(400);
        await malformed.text();
        const cookieRequest = await fetch(base + "/asset.js", {
            headers: { cookie: "tessera_preview_context=ws-a:70000" },
        });
        expect(cookieRequest.status).toBe(404);
        await cookieRequest.text();
        const invalidHost = await request(base, "p70000-" + "0".repeat(32) + ".preview.localhost");
        expect(invalidHost.status).toBe(400);
        await invalidHost.text();
        expect(runner.getWorkspaceContainerIp).not.toHaveBeenCalled();
        const health = await fetch(base + "/health");
        expect(health.status).toBe(200);
        await health.text();
    });

    it("renders a friendly diagnostic when no dev server is listening", async () => {
        const dummy = http.createServer();
        const unusedPort = await listen(dummy);
        await new Promise<void>((resolve) => dummy.close(() => resolve()));
        const { base } = await engine();
        const host = await previewHost(base, "ws-a", unusedPort);
        const response = await request(base, host);
        expect(response.status).toBe(502);
        expect(await response.text()).toContain("Server Not Yet Listening");
    });

    it("contains asynchronous lookup failures and escapes diagnostic text", async () => {
        const runner = mockRunner();
        runner.getWorkspaceContainerIp.mockRejectedValue(new Error("<script>bad</script>"));
        const { base } = await engine(runner);
        const host = await previewHost(base, "ws-a", 5173);
        const response = await request(base, host);
        expect(response.status).toBe(502);
        expect(await response.text()).toContain("&lt;script&gt;bad&lt;/script&gt;");
        const health = await fetch(base + "/health");
        expect(health.status).toBe(200);
        await health.text();
    });
});

describe("preview WebSocket routing", () => {
    it("tunnels root upgrades and head bytes to the correct preview, including application Socket.IO paths", async () => {
        const a = await target((_req, res) => res.end("A"));
        const b = await target((_req, res) => res.end("B"));
        const upgrades: string[] = [];
        for (const [label, upstream] of [["A", a], ["B", b]] as const) {
            upstream.server.on("upgrade", (req, socket, head) => {
                upgrades.push(label + ":" + req.url);
                socket.write("HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n");
                socket.write(head);
                socket.pipe(socket);
            });
        }
        const { base, port } = await engine();
        const hostA = await previewHost(base, "ws-a", a.port);
        const hostB = await previewHost(base, "ws-b", b.port);

        for (const [host, path] of [[hostA, "/?token=a"], [hostB, "/socket.io/?token=b"]]) {
            await new Promise<void>((resolve, reject) => {
                const socket = net.connect(port, "127.0.0.1", () => {
                    socket.write(`GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nCookie: tessera_preview_context=ws-b:${b.port}\r\n\r\nearly-frame`);
                });
                sockets.add(socket);
                let received = "";
                socket.setTimeout(2_000, () => reject(new Error("Upgrade timed out")));
                socket.on("error", reject);
                socket.on("data", (chunk) => {
                    received += chunk.toString();
                    if (received.includes("early-frame")) {
                        expect(received).toContain("101 Switching Protocols");
                        socket.destroy();
                        resolve();
                    }
                });
            });
        }
        expect(upgrades).toEqual(["A:/?token=a", "B:/socket.io/?token=b"]);
    });

    it("keeps terminal WebSockets and polling on the engine after preview is opened", async () => {
        const forwarded: string[] = [];
        const upstream = await target((req, res) => { forwarded.push(req.url ?? ""); res.end("preview"); });
        const { base } = await engine();
        const host = await previewHost(base, "ws-a", upstream.port);
        await (await request(base, host)).text();
        for (const transport of ["websocket", "polling"]) {
            const client = io(base + "/terminal", {
                transports: [transport], reconnection: false,
                extraHeaders: { Cookie: `tessera_preview_context=ws-a:${upstream.port}` },
            });
            clients.push(client);
            await new Promise<void>((resolve, reject) => {
                client.once("connect", resolve);
                client.once("connect_error", reject);
            });
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(client.connected).toBe(true);
        }
        expect(forwarded).toEqual(["/"]);
    });

    it("closes upgrades cleanly when container lookup fails", async () => {
        const runner = mockRunner();
        runner.getWorkspaceContainerIp.mockRejectedValue(new Error("Docker unavailable"));
        const proxy = new PreviewProxy(runner as unknown as TerminalRunner);
        const socket = { destroy: vi.fn() } as unknown as net.Socket;
        const req = { url: "/preview/ws-a/5173", headers: {} } as http.IncomingMessage;
        await proxy.handleUpgrade(req, socket, Buffer.alloc(0));
        expect(socket.destroy).toHaveBeenCalled();
    });
});
