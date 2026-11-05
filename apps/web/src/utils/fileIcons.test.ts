import { describe, it, expect } from "vitest";
import { getFileExtension, getFileMeta } from "./fileIcons.js";

describe("fileIcons utility", () => {
  describe("getFileExtension", () => {
    it("extracts extension from standard filenames", () => {
      expect(getFileExtension("index.ts")).toBe("ts");
      expect(getFileExtension("component.tsx")).toBe("tsx");
      expect(getFileExtension("server.js")).toBe("js");
      expect(getFileExtension("main.py")).toBe("py");
      expect(getFileExtension("Cargo.toml")).toBe("toml");
    });

    it("handles multiple dots and nested extensions", () => {
      expect(getFileExtension("app.test.tsx")).toBe("tsx");
      expect(getFileExtension("archive.tar.gz")).toBe("gz");
    });

    it("returns empty string when there is no extension", () => {
      expect(getFileExtension("Makefile")).toBe("");
      expect(getFileExtension("Dockerfile")).toBe("");
      expect(getFileExtension("")).toBe("");
    });

    it("returns empty string for hidden dotfiles without extension", () => {
      expect(getFileExtension(".env")).toBe("");
      expect(getFileExtension(".gitignore")).toBe("");
    });

    it("handles trailing dot gracefully", () => {
      expect(getFileExtension("filename.")).toBe("");
    });

    it("normalizes uppercase extensions to lowercase", () => {
      expect(getFileExtension("INDEX.TS")).toBe("ts");
      expect(getFileExtension("script.PY")).toBe("py");
    });
  });

  describe("getFileMeta", () => {
    it("returns correct metadata for TypeScript and JavaScript", () => {
      const tsMeta = getFileMeta("app.ts");
      expect(tsMeta.label).toBe("TS");
      expect(tsMeta.color).toBe("#38bdf8");

      const jsMeta = getFileMeta("index.jsx");
      expect(jsMeta.label).toBe("JSX");
      expect(jsMeta.color).toBe("#facc15");
    });

    it("returns correct metadata for Python and Rust", () => {
      const pyMeta = getFileMeta("main.py");
      expect(pyMeta.label).toBe("PY");

      const rsMeta = getFileMeta("lib.rs");
      expect(rsMeta.label).toBe("RS");
    });

    it("returns specialized config metadata for package.json and tsconfig.json", () => {
      const pkgMeta = getFileMeta("package.json");
      expect(pkgMeta.label).toBe("JSON");

      const tsconfigMeta = getFileMeta("tsconfig.json");
      expect(tsconfigMeta.label).toBe("JSON");
    });

    it("returns specialized config metadata for Dockerfile and dot env files", () => {
      const dockerMeta = getFileMeta("Dockerfile");
      expect(dockerMeta.label).toBe("CONFIG");

      const envMeta = getFileMeta(".env.local");
      expect(envMeta.label).toBe("CONFIG");
    });

    it("returns default fallback metadata for unrecognized extensions", () => {
      const unknownMeta = getFileMeta("unknown.xyz");
      expect(unknownMeta.label).toBe("XYZ");
      expect(unknownMeta.color).toBe("#94a3b8");

      const noExtMeta = getFileMeta("LICENSE");
      expect(noExtMeta.label).toBe("FILE");
    });
  });
});
