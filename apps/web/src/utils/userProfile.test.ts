import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISPLAY_NAME_STORAGE_KEY,
  getSavedDisplayName,
  saveDisplayName,
} from "./userProfile.js";

describe("userProfile localStorage persistence", () => {
  let store: Record<string, string> = {};
  const mockStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };

  beforeEach(() => {
    store = {};
    vi.clearAllMocks();
    (globalThis as unknown as { window?: unknown }).window = {
      localStorage: mockStorage,
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("returns null in non-window (SSR/Node) environment", () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    expect(getSavedDisplayName()).toBeNull();
  });

  it("returns null when no display name is saved", () => {
    expect(getSavedDisplayName()).toBeNull();
  });

  it("saves and retrieves a valid display name", () => {
    saveDisplayName("Kushaal");
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      DISPLAY_NAME_STORAGE_KEY,
      "Kushaal",
    );
    expect(getSavedDisplayName()).toBe("Kushaal");
  });

  it("trims whitespace when saving and retrieving", () => {
    saveDisplayName("   Alice Smith   ");
    expect(getSavedDisplayName()).toBe("Alice Smith");
  });

  it("does not save empty or whitespace-only names", () => {
    saveDisplayName("   ");
    expect(mockStorage.setItem).not.toHaveBeenCalled();
    expect(getSavedDisplayName()).toBeNull();
  });

  it("gracefully catches localStorage errors on get", () => {
    mockStorage.getItem.mockImplementationOnce(() => {
      throw new Error("SecurityError");
    });
    expect(getSavedDisplayName()).toBeNull();
  });

  it("gracefully catches localStorage errors on save", () => {
    mockStorage.setItem.mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveDisplayName("Bob")).not.toThrow();
  });
});
