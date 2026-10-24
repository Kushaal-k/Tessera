import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
    isCleanBoundaryIgnored,
    isBinaryBuffer,
    inspectFileForSync,
    MAX_SYNC_FILE_SIZE,
} from "./workspacePolicy.js";

describe("Workspace Policy", () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tessera-policy-test-"));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe("isCleanBoundaryIgnored", () => {
        it("identifies clean boundary root and nested paths as ignored", () => {
            expect(isCleanBoundaryIgnored("node_modules")).toBe(true);
            expect(isCleanBoundaryIgnored("node_modules/lodash/index.js")).toBe(true);
            expect(isCleanBoundaryIgnored("nested/node_modules/dep/package.json")).toBe(true);

            expect(isCleanBoundaryIgnored(".git")).toBe(true);
            expect(isCleanBoundaryIgnored(".git/config")).toBe(true);

            expect(isCleanBoundaryIgnored(".npm")).toBe(true);
            expect(isCleanBoundaryIgnored(".npm/cache")).toBe(true);

            expect(isCleanBoundaryIgnored("dist")).toBe(true);
            expect(isCleanBoundaryIgnored("dist/main.js")).toBe(true);
            expect(isCleanBoundaryIgnored("packages/core/dist/index.js")).toBe(true);

            expect(isCleanBoundaryIgnored(".turbo")).toBe(true);
            expect(isCleanBoundaryIgnored(".cache")).toBe(true);
            expect(isCleanBoundaryIgnored(".DS_Store")).toBe(true);
            expect(isCleanBoundaryIgnored("folder/.DS_Store")).toBe(true);
        });

        it("permits regular source files and safe names", () => {
            expect(isCleanBoundaryIgnored("src/index.ts")).toBe(false);
            expect(isCleanBoundaryIgnored("package.json")).toBe(false);
            expect(isCleanBoundaryIgnored("my-dist/app.js")).toBe(false);
            expect(isCleanBoundaryIgnored("distance/calculator.ts")).toBe(false);
            expect(isCleanBoundaryIgnored("src/git-helper.ts")).toBe(false);
        });
    });

    describe("isBinaryBuffer", () => {
        it("returns false for plain text buffers", () => {
            const buf = Buffer.from("Hello world, this is utf-8 text!");
            expect(isBinaryBuffer(buf)).toBe(false);
        });

        it("returns true for buffers containing null bytes", () => {
            const binaryBuf = Buffer.from([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x77, 0x6f]);
            expect(isBinaryBuffer(binaryBuf)).toBe(true);
        });
    });

    describe("inspectFileForSync", () => {
        it("rejects files in clean boundaries immediately without disk reading", async () => {
            const filePath = path.join(tempDir, "node_modules", "package.json");
            const result = await inspectFileForSync(filePath, "node_modules/package.json");
            expect(result.eligible).toBe(false);
            expect(result.reason).toBe("ignored");
        });

        it("detects oversized files and rejects before loading full content", async () => {
            const oversizedPath = path.join(tempDir, "big-file.dat");
            const targetSize = MAX_SYNC_FILE_SIZE + 1024;
            const handle = await fs.open(oversizedPath, "w");
            await handle.truncate(targetSize);
            await handle.close();

            const result = await inspectFileForSync(oversizedPath, "big-file.dat", tempDir);
            expect(result.eligible).toBe(false);
            expect(result.reason).toBe("oversized");
            expect(result.size).toBe(targetSize);
            expect(result.content).toBeUndefined();
        });

        it("detects binary files via sample and rejects before reading full file", async () => {
            const binaryPath = path.join(tempDir, "sample.png");
            const binaryData = Buffer.alloc(4096);
            binaryData.fill(0x41);
            binaryData[10] = 0x00; // null byte
            await fs.writeFile(binaryPath, binaryData);

            const result = await inspectFileForSync(binaryPath, "sample.png", tempDir);
            expect(result.eligible).toBe(false);
            expect(result.reason).toBe("binary");
            expect(result.size).toBe(4096);
            expect(result.content).toBeUndefined();
        });

        it("inspects and returns text content for valid text files under size limit", async () => {
            const textPath = path.join(tempDir, "index.ts");
            const textContent = "export const answer = 42;\n";
            await fs.writeFile(textPath, textContent, "utf-8");

            const result = await inspectFileForSync(textPath, "index.ts", tempDir);
            expect(result.eligible).toBe(true);
            expect(result.size).toBe(Buffer.byteLength(textContent));
            expect(result.content).toBe(textContent);
        });

        it("rejects files escaping rootDir via symlinks", async () => {
            const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "tessera-outside-policy-"));
            const outsideFile = path.join(outsideDir, "secret.env");
            await fs.writeFile(outsideFile, "SECRET=123", "utf-8");

            try {
                const symlinkPath = path.join(tempDir, "escape.env");
                await fs.symlink(outsideFile, symlinkPath);

                const result = await inspectFileForSync(symlinkPath, "escape.env", tempDir);
                expect(result.eligible).toBe(false);
                expect(result.reason).toBe("ignored");
            } finally {
                await fs.rm(outsideDir, { recursive: true, force: true });
            }
        });
    });
});

