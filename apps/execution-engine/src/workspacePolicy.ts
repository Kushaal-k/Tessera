import fs from "node:fs/promises";
import path from "node:path";

export const MAX_SYNC_FILE_SIZE = 2 * 1024 * 1024; // 2MB
export const MAX_SYNC_FILE_COUNT = 2000;           // Prevents scanning exhaustion
export const BINARY_SAMPLE_SIZE = 512;             // Fast null-byte detection window

export const CLEAN_BOUNDARY_PATTERNS: readonly RegExp[] = [
    /(?:^|[\\/])node_modules(?:[\\/]|$)/,
    /(?:^|[\\/])\.git(?:[\\/]|$)/,
    /(?:^|[\\/])\.npm(?:[\\/]|$)/,
    /(?:^|[\\/])dist(?:[\\/]|$)/,
    /(?:^|[\\/])\.turbo(?:[\\/]|$)/,
    /(?:^|[\\/])\.cache(?:[\\/]|$)/,
    /(?:^|[\\/])\.DS_Store$/,
];

export function isCleanBoundaryIgnored(relativePath: string): boolean {
    for (const pattern of CLEAN_BOUNDARY_PATTERNS) {
        if (pattern.test(relativePath)) {
            return true;
        }
    }
    return false;
}

export function isBinaryBuffer(buffer: Buffer): boolean {
    const checkLength = Math.min(buffer.length, BINARY_SAMPLE_SIZE);
    for (let i = 0; i < checkLength; i++) {
        if (buffer[i] === 0) {
            return true;
        }
    }
    return false;
}

export interface FileInspectionResult {
    readonly eligible: boolean;
    readonly size: number;
    readonly reason?: "ignored" | "oversized" | "binary";
    readonly content?: string;
}

export async function inspectFileForSync(
    fullPath: string,
    relativePath: string,
    rootDir?: string,
    maxFileSize: number = MAX_SYNC_FILE_SIZE,
): Promise<FileInspectionResult> {
    if (isCleanBoundaryIgnored(relativePath)) {
        return { eligible: false, size: 0, reason: "ignored" };
    }

    if (rootDir) {
        try {
            const resolvedRoot = path.resolve(rootDir);
            const realPath = await fs.realpath(fullPath);
            if (realPath !== resolvedRoot && !realPath.startsWith(resolvedRoot + path.sep)) {
                return { eligible: false, size: 0, reason: "ignored" };
            }
            const realRel = path.relative(resolvedRoot, realPath);
            if (isCleanBoundaryIgnored(realRel)) {
                return { eligible: false, size: 0, reason: "ignored" };
            }
        } catch {
            return { eligible: false, size: 0, reason: "ignored" };
        }
    }

    let stat: import("node:fs").Stats;
    try {
        stat = await fs.stat(fullPath);
    } catch {
        return { eligible: false, size: 0, reason: "ignored" };
    }

    if (!stat.isFile()) {
        return { eligible: false, size: stat.size, reason: "ignored" };
    }

    if (stat.size > maxFileSize) {
        return { eligible: false, size: stat.size, reason: "oversized" };
    }

    let handle: import("node:fs/promises").FileHandle | null = null;
    try {
        handle = await fs.open(fullPath, "r");
        const sampleSize = Math.min(stat.size, BINARY_SAMPLE_SIZE);
        const buffer = Buffer.alloc(sampleSize);
        if (sampleSize > 0) {
            await handle.read(buffer, 0, sampleSize, 0);
            if (isBinaryBuffer(buffer)) {
                return { eligible: false, size: stat.size, reason: "binary" };
            }
        }
        const fullBuffer = await handle.readFile({ encoding: "utf-8" });
        return { eligible: true, size: stat.size, content: fullBuffer };
    } catch {
        return { eligible: false, size: stat.size, reason: "ignored" };
    } finally {
        if (handle) {
            await handle.close();
        }
    }
}
