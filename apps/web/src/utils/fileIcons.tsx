import type { ReactElement } from "react";
import {
  FileCode,
  FileJson,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCog,
  FileTerminal,
  Code2,
} from "lucide-react";

export interface FileIconMeta {
  readonly label: string;
  readonly color: string;
  readonly bg: string;
  readonly border: string;
}

export function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    return "";
  }
  return filename.slice(dotIndex + 1).toLowerCase();
}

export function getFileMeta(filename: string): FileIconMeta {
  const ext = getFileExtension(filename);
  const lowerName = filename.toLowerCase();

  if (lowerName === "package.json" || lowerName === "tsconfig.json") {
    return {
      label: "JSON",
      color: "#4ade80",
      bg: "rgba(74, 222, 128, 0.12)",
      border: "rgba(74, 222, 128, 0.25)",
    };
  }

  if (lowerName === "dockerfile" || lowerName.startsWith(".env")) {
    return {
      label: "CONFIG",
      color: "#38bdf8",
      bg: "rgba(56, 189, 248, 0.12)",
      border: "rgba(56, 189, 248, 0.25)",
    };
  }

  switch (ext) {
    case "ts":
    case "tsx":
      return {
        label: ext.toUpperCase(),
        color: "#38bdf8",
        bg: "rgba(56, 189, 248, 0.12)",
        border: "rgba(56, 189, 248, 0.3)",
      };
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return {
        label: ext.toUpperCase(),
        color: "#facc15",
        bg: "rgba(250, 204, 21, 0.12)",
        border: "rgba(250, 204, 21, 0.3)",
      };
    case "py":
      return {
        label: "PY",
        color: "#38bdf8",
        bg: "rgba(56, 189, 248, 0.12)",
        border: "rgba(56, 189, 248, 0.3)",
      };
    case "rs":
      return {
        label: "RS",
        color: "#fb923c",
        bg: "rgba(251, 146, 60, 0.12)",
        border: "rgba(251, 146, 60, 0.3)",
      };
    case "cpp":
    case "c":
    case "cc":
    case "cxx":
    case "h":
    case "hpp":
      return {
        label: "C++",
        color: "#60a5fa",
        bg: "rgba(96, 165, 250, 0.12)",
        border: "rgba(96, 165, 250, 0.3)",
      };
    case "java":
      return {
        label: "JAVA",
        color: "#f87171",
        bg: "rgba(248, 113, 113, 0.12)",
        border: "rgba(248, 113, 113, 0.3)",
      };
    case "go":
      return {
        label: "GO",
        color: "#22d3ee",
        bg: "rgba(34, 211, 238, 0.12)",
        border: "rgba(34, 211, 238, 0.3)",
      };
    case "html":
    case "htm":
      return {
        label: "HTML",
        color: "#fb923c",
        bg: "rgba(251, 146, 60, 0.12)",
        border: "rgba(251, 146, 60, 0.3)",
      };
    case "css":
    case "scss":
    case "sass":
    case "less":
      return {
        label: "CSS",
        color: "#38bdf8",
        bg: "rgba(56, 189, 248, 0.12)",
        border: "rgba(56, 189, 248, 0.3)",
      };
    case "json":
      return {
        label: "JSON",
        color: "#4ade80",
        bg: "rgba(74, 222, 128, 0.12)",
        border: "rgba(74, 222, 128, 0.25)",
      };
    case "md":
    case "markdown":
      return {
        label: "MD",
        color: "#c084fc",
        bg: "rgba(192, 132, 252, 0.12)",
        border: "rgba(192, 132, 252, 0.25)",
      };
    case "yaml":
    case "yml":
    case "toml":
      return {
        label: "YAML",
        color: "#94a3b8",
        bg: "rgba(148, 163, 184, 0.12)",
        border: "rgba(148, 163, 184, 0.25)",
      };
    case "sh":
    case "bash":
    case "zsh":
      return {
        label: "SH",
        color: "#34d399",
        bg: "rgba(52, 211, 153, 0.12)",
        border: "rgba(52, 211, 153, 0.25)",
      };
    case "svg":
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
      return {
        label: "IMG",
        color: "#f472b6",
        bg: "rgba(244, 114, 182, 0.12)",
        border: "rgba(244, 114, 182, 0.25)",
      };
    default:
      return {
        label: ext.toUpperCase() || "FILE",
        color: "#94a3b8",
        bg: "rgba(148, 163, 184, 0.1)",
        border: "rgba(148, 163, 184, 0.2)",
      };
  }
}

export function FileIcon({
  filename,
  className = "h-3.5 w-3.5 shrink-0",
}: {
  readonly filename: string;
  readonly className?: string;
}): ReactElement {
  const ext = getFileExtension(filename);
  const lowerName = filename.toLowerCase();

  if (lowerName === "package.json" || ext === "json") {
    return <FileJson className={`${className} text-emerald-400`} />;
  }

  if (lowerName.startsWith(".env") || ext === "yaml" || ext === "yml" || ext === "toml") {
    return <FileCog className={`${className} text-zinc-400`} />;
  }

  if (ext === "sh" || ext === "bash" || ext === "zsh") {
    return <FileTerminal className={`${className} text-emerald-400`} />;
  }

  if (ext === "svg" || ext === "png" || ext === "jpg" || ext === "webp") {
    return <FileImage className={`${className} text-pink-400`} />;
  }

  if (ext === "md" || ext === "txt") {
    return <FileText className={`${className} text-purple-400`} />;
  }

  if (ext === "csv") {
    return <FileSpreadsheet className={`${className} text-teal-400`} />;
  }

  if (ext === "ts" || ext === "tsx") {
    return <Code2 className={`${className} text-sky-400`} />;
  }

  if (ext === "js" || ext === "jsx") {
    return <Code2 className={`${className} text-amber-300`} />;
  }

  if (ext === "py") {
    return <FileCode className={`${className} text-sky-300`} />;
  }

  if (ext === "rs") {
    return <FileCode className={`${className} text-orange-400`} />;
  }

  if (ext === "cpp" || ext === "c" || ext === "h" || ext === "hpp") {
    return <FileCode className={`${className} text-blue-400`} />;
  }

  if (ext === "java") {
    return <FileCode className={`${className} text-rose-400`} />;
  }

  if (ext === "go") {
    return <FileCode className={`${className} text-cyan-400`} />;
  }

  if (ext === "html") {
    return <FileCode className={`${className} text-amber-500`} />;
  }

  if (ext === "css" || ext === "scss") {
    return <FileCode className={`${className} text-sky-400`} />;
  }

  return <FileCode className={`${className} text-zinc-400`} />;
}
