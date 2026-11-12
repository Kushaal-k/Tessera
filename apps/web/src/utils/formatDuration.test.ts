import { describe, expect, it } from "vitest";
import { formatDurationMs } from "./formatDuration.js";

describe("formatDurationMs", () => {
  it("rounds sub-second timings to whole milliseconds", () => {
    expect(formatDurationMs(42.7)).toBe("43ms");
    expect(formatDurationMs(0)).toBe("0ms");
  });

  it("collapses floating-point noise above one second", () => {
    expect(formatDurationMs(1199.80367199999916)).toBe("1.20s");
  });

  it("uses one decimal between ten seconds and a minute", () => {
    expect(formatDurationMs(12450)).toBe("12.5s");
  });

  it("uses minutes once the run passes a minute", () => {
    expect(formatDurationMs(83000)).toBe("1m 23s");
  });

  it("treats invalid values as zero", () => {
    expect(formatDurationMs(Number.NaN)).toBe("0ms");
    expect(formatDurationMs(-5)).toBe("0ms");
  });
});
