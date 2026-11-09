import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createAwareness, setLocalParticipant } from "@tessera/collaboration";
import type { Participant } from "@tessera/shared-types";
import {
  colorToRgba,
  generateMonacoDecorationStyles,
} from "./useMonacoDecorations.js";

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: "user-1",
    displayName: "Kushaal",
    isAI: false,
    cursorColor: "#5c7cfa",
    ...overrides,
  };
}

describe("colorToRgba", () => {
  it("converts 6-digit hex color to rgba with given alpha", () => {
    expect(colorToRgba("#5c7cfa", 0.25)).toBe("rgba(92, 124, 250, 0.25)");
    expect(colorToRgba("#000000", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
    expect(colorToRgba("#ffffff", 1)).toBe("rgba(255, 255, 255, 1)");
  });

  it("converts 3-digit hex color to rgba", () => {
    expect(colorToRgba("#f00", 0.3)).toBe("rgba(255, 0, 0, 0.3)");
  });

  it("handles rgb() color strings", () => {
    expect(colorToRgba("rgb(10, 20, 30)", 0.2)).toBe("rgba(10, 20, 30, 0.2)");
  });

  it("falls back to default rgba for unknown formats", () => {
    expect(colorToRgba("invalid", 0.25)).toBe("rgba(99, 102, 241, 0.25)");
  });
});

describe("generateMonacoDecorationStyles", () => {
  it("returns empty string when there are no remote peers", () => {
    const ydoc = new Y.Doc();
    const awareness = createAwareness(ydoc);
    setLocalParticipant(awareness, makeParticipant());

    const css = generateMonacoDecorationStyles(awareness);
    expect(css.trim()).toBe("");
    ydoc.destroy();
  });

  it("generates decoration CSS rules for remote peers in awareness", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    const awareness1 = createAwareness(doc1);
    const awareness2 = createAwareness(doc2);

    setLocalParticipant(awareness1, makeParticipant({ displayName: "LocalUser" }));
    setLocalParticipant(
      awareness2,
      makeParticipant({
        id: "peer-2",
        displayName: "RemoteAlice",
        cursorColor: "#e11d48",
      }),
    );

    // Simulate awareness sync from doc2 to doc1
    const state2 = awareness2.getLocalState();
    if (state2) {
      awareness1.getStates().set(awareness2.clientID, state2);
    }

    const css = generateMonacoDecorationStyles(awareness1);
    expect(css).toContain(`.yRemoteSelection-${awareness2.clientID}`);
    expect(css).toContain(`.yRemoteSelectionHead-${awareness2.clientID}`);
    expect(css).toContain('content: "RemoteAlice" !important;');
    expect(css).toContain("border-left-color: #e11d48 !important;");

    doc1.destroy();
    doc2.destroy();
  });

  it("sanitizes quotes in display name to prevent CSS injection", () => {
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    const awareness1 = createAwareness(doc1);
    const awareness2 = createAwareness(doc2);

    setLocalParticipant(awareness1, makeParticipant());
    setLocalParticipant(
      awareness2,
      makeParticipant({
        displayName: 'Malicious"Name; injection',
        cursorColor: "#10b981",
      }),
    );

    const state2 = awareness2.getLocalState();
    if (state2) {
      awareness1.getStates().set(awareness2.clientID, state2);
    }

    const css = generateMonacoDecorationStyles(awareness1);
    expect(css).toContain('content: "MaliciousName; injection" !important;');
    expect(css).not.toContain('"Malicious"');

    doc1.destroy();
    doc2.destroy();
  });
});
