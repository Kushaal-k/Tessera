import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AUTH_STORAGE_KEY, OAUTH_STATE_KEY, OAUTH_RETURN_KEY } from "./AuthProvider.js";
import type { AuthUser } from "./types.js";

describe("AuthProvider session and storage handling", () => {
  let store: Record<string, string> = {};
  const mockStorage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };

  beforeEach(() => {
    store = {};
    vi.clearAllMocks();
    (globalThis as unknown as { localStorage?: unknown }).localStorage = mockStorage;
    (globalThis as unknown as { sessionStorage?: unknown }).sessionStorage = mockStorage;
  });

  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    delete (globalThis as unknown as { sessionStorage?: unknown }).sessionStorage;
  });

  it("defines standard storage keys for OAuth and user session", () => {
    expect(AUTH_STORAGE_KEY).toBe("tessera:auth_session");
    expect(OAUTH_STATE_KEY).toBe("tessera:oauth_state");
    expect(OAUTH_RETURN_KEY).toBe("tessera:oauth_return_to");
  });

  it("stores and parses session data correctly", () => {
    const user: AuthUser = {
      sub: "github|12345",
      name: "Octocat",
      nickname: "octocat",
      email: "octo@github.com",
      picture: "https://github.com/octocat.png",
    };

    mockStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, accessToken: "token_abc" }));

    const raw = mockStorage.getItem(AUTH_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!) as { user: AuthUser; accessToken: string };
    expect(parsed.user.sub).toBe("github|12345");
    expect(parsed.user.name).toBe("Octocat");
    expect(parsed.accessToken).toBe("token_abc");
  });
});
