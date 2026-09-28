import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  createAwareness,
  setLocalParticipant,
  getRemotePeers,
  onPeersChanged,
} from "@tessera/collaboration";
import type { Participant } from "@tessera/shared-types";

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: "test-001",
    displayName: "Anonymous",
    isAI: false,
    cursorColor: "#5c7cfa",
    ...overrides,
  };
}

describe("setLocalParticipant — initial write", () => {
  it("stores the full participant in the local awareness state", () => {
    const ydoc = new Y.Doc();
    const awareness = createAwareness(ydoc);
    const participant = makeParticipant({ displayName: "Pals" });

    setLocalParticipant(awareness, participant);

    const state = awareness.getLocalState() as Record<string, unknown>;
    expect(state?.["participant"]).toEqual(participant);
    ydoc.destroy();
  });
});

describe("setLocalParticipant — dynamic displayName update", () => {
  it("reflects an updated displayName when called a second time", () => {
    const ydoc = new Y.Doc();
    const awareness = createAwareness(ydoc);
    const base = makeParticipant();

    setLocalParticipant(awareness, base);
    setLocalParticipant(awareness, { ...base, displayName: "Kushaal" });

    const state = awareness.getLocalState() as Record<string, unknown>;
    expect((state?.["participant"] as Participant).displayName).toBe("Kushaal");
    ydoc.destroy();
  });

  it("preserves id and cursorColor when only displayName changes", () => {
    const ydoc = new Y.Doc();
    const awareness = createAwareness(ydoc);
    const base = makeParticipant({ id: "stable-id", cursorColor: "#ff0000" });

    setLocalParticipant(awareness, base);
    setLocalParticipant(awareness, { ...base, displayName: "NewName" });

    const state = awareness.getLocalState() as Record<string, unknown>;
    const stored = state?.["participant"] as Participant;
    expect(stored.id).toBe("stable-id");
    expect(stored.cursorColor).toBe("#ff0000");
    expect(stored.isAI).toBe(false);
    ydoc.destroy();
  });

  it("fires an awareness 'change' event on each call (provider uses this for broadcast)", () => {
    const ydoc = new Y.Doc();
    const awareness = createAwareness(ydoc);
    const changeSpy = vi.fn();
    awareness.on("change", changeSpy);

    const base = makeParticipant();
    setLocalParticipant(awareness, base);
    expect(changeSpy).toHaveBeenCalledTimes(1);

    setLocalParticipant(awareness, { ...base, displayName: "Updated" });
    expect(changeSpy).toHaveBeenCalledTimes(2);

    awareness.off("change", changeSpy);
    ydoc.destroy();
  });

  it("fires 'change' event even if displayName is empty string (blank input edge case)", () => {
    const ydoc = new Y.Doc();
    const awareness = createAwareness(ydoc);
    const changeSpy = vi.fn();
    awareness.on("change", changeSpy);

    setLocalParticipant(awareness, makeParticipant());
    setLocalParticipant(awareness, makeParticipant({ displayName: "" }));

    expect(changeSpy).toHaveBeenCalledTimes(2);
    awareness.off("change", changeSpy);
    ydoc.destroy();
  });
});

describe("getRemotePeers", () => {
  it("excludes the local client — only one participant present means zero peers", () => {
    const ydoc = new Y.Doc();
    const awareness = createAwareness(ydoc);
    setLocalParticipant(awareness, makeParticipant());

    expect(getRemotePeers(awareness)).toHaveLength(0);
    ydoc.destroy();
  });
});

describe("onPeersChanged", () => {
  it("returns a working unsubscribe function", () => {
    const ydoc = new Y.Doc();
    const awareness = createAwareness(ydoc);
    const cb = vi.fn();

    const unsubscribe = onPeersChanged(awareness, cb);
    unsubscribe();

    // After unsubscribing, further awareness updates must not trigger cb
    setLocalParticipant(awareness, makeParticipant());
    expect(cb).not.toHaveBeenCalled();
    ydoc.destroy();
  });
});