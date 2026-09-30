import { describe, expect, it } from "vitest";
import { useTerminal } from "./useTerminal.js";

describe("useTerminal hook", () => {
  it("exports a valid custom React hook", () => {
    expect(typeof useTerminal).toBe("function");
  });
});
