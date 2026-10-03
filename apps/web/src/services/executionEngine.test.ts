import { afterEach, describe, expect, it, vi } from "vitest";
import { getExecutionEngineUrl } from "./executionEngine.js";

afterEach(() => vi.unstubAllEnvs());

describe("execution engine endpoint", () => {
  it("uses the configured engine for both terminal and preview", () => {
    vi.stubEnv("VITE_EXECUTION_ENGINE_URL", "https://engine.example.com/");
    expect(getExecutionEngineUrl()).toBe("https://engine.example.com");
  });

  it("prefers an explicit endpoint and strips trailing slashes", () => {
    vi.stubEnv("VITE_EXECUTION_ENGINE_URL", "https://engine.example.com");
    expect(getExecutionEngineUrl("http://localhost:5002///")).toBe("http://localhost:5002");
  });

  it("uses the local engine when no endpoint is configured", () => {
    vi.stubEnv("VITE_EXECUTION_ENGINE_URL", undefined);
    expect(getExecutionEngineUrl()).toBe("http://localhost:4002");
  });
});
