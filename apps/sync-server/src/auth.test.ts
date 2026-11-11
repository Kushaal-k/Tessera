import { describe, it, expect, vi } from "vitest";
import http from "node:http";
import express from "express";
import type { AddressInfo } from "node:net";
import {
  normalizeGitHubUser,
  exchangeGitHubCode,
  fetchGitHubProfile,
  createAuthRouter,
  type GitHubUserDTO,
  type GitHubEmailDTO,
} from "./auth.js";

describe("GitHub authentication utilities", () => {
  describe("normalizeGitHubUser", () => {
    it("normalizes user profile with explicit name and email", () => {
      const rawUser: GitHubUserDTO = {
        id: 12345,
        login: "octocat",
        name: "Mona Lisa Octocat",
        email: "mona@github.com",
        avatar_url: "https://github.com/images/error/octocat_happy.gif",
      };

      const normalized = normalizeGitHubUser(rawUser);

      expect(normalized).toEqual({
        sub: "github|12345",
        name: "Mona Lisa Octocat",
        nickname: "octocat",
        email: "mona@github.com",
        picture: "https://github.com/images/error/octocat_happy.gif",
      });
    });

    it("falls back to login when name is null or whitespace", () => {
      const rawUser: GitHubUserDTO = {
        id: 67890,
        login: "tesseradev",
        name: "   ",
        email: null,
        avatar_url: "https://avatars.githubusercontent.com/u/67890",
      };

      const normalized = normalizeGitHubUser(rawUser, "verified@example.com");

      expect(normalized.name).toBe("tesseradev");
      expect(normalized.email).toBe("verified@example.com");
    });
  });

  describe("exchangeGitHubCode", () => {
    it("returns access token when exchange succeeds", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "gho_test_token_123",
          token_type: "bearer",
        }),
      });

      const result = await exchangeGitHubCode(
        "valid_auth_code",
        "mock_client_id",
        "mock_client_secret",
        mockFetch as unknown as typeof fetch,
      );

      expect(result.accessToken).toBe("gho_test_token_123");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://github.com/login/oauth/access_token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Accept: "application/json",
          }),
        }),
      );
    });

    it("throws descriptive error when GitHub returns error payload", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          error: "bad_verification_code",
          error_description: "The code passed is incorrect or has expired.",
        }),
      });

      await expect(
        exchangeGitHubCode(
          "expired_code",
          "mock_client_id",
          "mock_client_secret",
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow("The code passed is incorrect or has expired.");
    });
  });

  describe("fetchGitHubProfile", () => {
    it("fetches user and retrieves primary verified email if missing from base user", async () => {
      const rawUser: GitHubUserDTO = {
        id: 999,
        login: "privateuser",
        name: "Private User",
        email: null,
        avatar_url: "https://avatars.githubusercontent.com/u/999",
      };

      const emails: GitHubEmailDTO[] = [
        { email: "secondary@example.com", primary: false, verified: true },
        { email: "primary@example.com", primary: true, verified: true },
      ];

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/user/emails")) {
          return Promise.resolve({
            ok: true,
            json: async () => emails,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => rawUser,
        });
      });

      const profile = await fetchGitHubProfile("gho_valid_token", mockFetch as unknown as typeof fetch);

      expect(profile.user.login).toBe("privateuser");
      expect(profile.primaryEmail).toBe("primary@example.com");
    });
  });

  describe("createAuthRouter integration", () => {
    let server: http.Server;
    let baseUrl: string;

    const setupServer = (config = {}): Promise<void> => {
      const app = express();
      app.use(express.json());
      app.use("/api/auth", createAuthRouter(config));
      server = http.createServer(app);

      return new Promise((resolve) => {
        server.listen(0, () => {
          const address = server.address() as AddressInfo;
          baseUrl = `http://127.0.0.1:${address.port}`;
          resolve();
        });
      });
    };

    const teardownServer = (): Promise<void> => {
      return new Promise((resolve) => {
        if (server) {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    };

    it("exposes /config endpoint with current configuration state", async () => {
      await setupServer({ clientId: "test_id", clientSecret: "test_secret" });

      const res = await fetch(`${baseUrl}/api/auth/config`);
      const body = (await res.json()) as { configured: boolean; clientId: string | null };

      expect(res.status).toBe(200);
      expect(body).toEqual({
        configured: true,
        clientId: "test_id",
      });

      await teardownServer();
    });

    it("returns developer fallback user when unconfigured", async () => {
      await setupServer({});

      const res = await fetch(`${baseUrl}/api/auth/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "any_code" }),
      });
      const body = (await res.json()) as { isDevFallback: boolean; user: { nickname: string } };

      expect(res.status).toBe(200);
      expect(body.isDevFallback).toBe(true);
      expect(body.user.nickname).toBe("developer");

      await teardownServer();
    });
  });
});
