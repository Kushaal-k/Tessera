import { useEffect } from "react";
import type { Awareness } from "y-protocols/awareness";
import type { Participant } from "@tessera/shared-types";

export function colorToRgba(color: string, alpha: number): string {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    } else if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
  }

  if (trimmed.startsWith("rgb(") && trimmed.endsWith(")")) {
    const inner = trimmed.slice(4, -1);
    return `rgba(${inner}, ${alpha})`;
  }

  return `rgba(99, 102, 241, ${alpha})`;
}

export function generateMonacoDecorationStyles(awareness: Awareness): string {
  let css = "";
  const localId = awareness.clientID;

  awareness.getStates().forEach((state, clientId) => {
    if (clientId === localId) {
      return;
    }

    const participant = (state as Record<string, unknown>)["participant"] as
      | Participant
      | undefined;

    if (!participant) {
      return;
    }

    const color = participant.cursorColor || "#6366f1";
    const name = (participant.displayName || "Anonymous")
      .trim()
      .replace(/["\\]/g, "");
    const bgRgba = colorToRgba(color, 0.25);

    css += `
.yRemoteSelection-${clientId} {
  background-color: ${bgRgba} !important;
}
.yRemoteSelectionHead-${clientId} {
  border-left-color: ${color} !important;
}
.yRemoteSelectionHead-${clientId}::after {
  content: "${name}" !important;
  background-color: ${color} !important;
}
`;
  });

  return css;
}

export function useMonacoDecorations(awareness: Awareness | null): void {
  useEffect(() => {
    if (!awareness || typeof document === "undefined") {
      return;
    }

    const styleId = "tessera-monaco-decorations";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const updateStyles = () => {
      if (styleEl) {
        styleEl.textContent = generateMonacoDecorationStyles(awareness);
      }
    };

    updateStyles();
    awareness.on("change", updateStyles);

    return () => {
      awareness.off("change", updateStyles);
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, [awareness]);
}
