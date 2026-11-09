import { describe, expect, it } from "vitest";
import { useAwarenessPeers } from "./useAwarenessPeers.js";

describe("useAwarenessPeers hook", () => {
  it("exports a valid custom React hook", () => {
    expect(typeof useAwarenessPeers).toBe("function");
  });
});
