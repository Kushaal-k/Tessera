import { Router, type Request, type Response } from "express";

export interface GitHubUserDTO {
  readonly id: number;
  readonly login: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly avatar_url: string;
}

export interface GitHubEmailDTO {
  readonly email: string;
  readonly primary: boolean;
  readonly verified: boolean;
}

export interface TesseraAuthUser {
  readonly sub: string;
  readonly name: string;
  readonly nickname: string;
  readonly email?: string;
  readonly picture: string;
}

export interface AuthConfig {
  readonly clientId?: string;
  readonly clientSecret?: string;
}

export interface ExchangeResult {
  readonly accessToken: string;
}

/**
 * Exchanges GitHub authorization code for an OAuth access token.
 */
export async function exchangeGitHubCode(
  code: string,
  clientId: string,
  clientSecret: string,
  fetchFn: typeof fetch = fetch,
): Promise<ExchangeResult> {
  const response = await fetchFn("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Tessera-Sync-Server",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange responded with status ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    const message = data.error_description || data.error || "Failed to exchange code";
    throw new Error(message);
  }

  return { accessToken: data.access_token };
}

/**
 * Fetches the authenticated user profile and primary verified email from GitHub.
 */
export async function fetchGitHubProfile(
  accessToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ user: GitHubUserDTO; primaryEmail?: string }> {
  const userResponse = await fetchFn("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Tessera-Sync-Server",
    },
  });

  if (!userResponse.ok) {
    throw new Error(`GitHub user request responded with status ${userResponse.status}`);
  }

  const user = (await userResponse.json()) as GitHubUserDTO;

  let primaryEmail = user.email ?? undefined;
  if (!primaryEmail) {
    try {
      const emailResponse = await fetchFn("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "Tessera-Sync-Server",
        },
      });

      if (emailResponse.ok) {
        const emails = (await emailResponse.json()) as readonly GitHubEmailDTO[];
        if (Array.isArray(emails)) {
          const matched = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified) ?? emails[0];
          if (matched?.email) {
            primaryEmail = matched.email;
          }
        }
      }
    } catch {
      // Graceful fallback: profile will not contain an email
    }
  }

  return { user, primaryEmail };
}

/**
 * Transforms raw GitHub user response into normalized TesseraAuthUser.
 */
export function normalizeGitHubUser(
  githubUser: GitHubUserDTO,
  primaryEmail?: string,
): TesseraAuthUser {
  return {
    sub: `github|${githubUser.id}`,
    name: githubUser.name?.trim() || githubUser.login,
    nickname: githubUser.login,
    email: primaryEmail ?? (githubUser.email ?? undefined),
    picture: githubUser.avatar_url,
  };
}

const MOCK_DEV_USER: TesseraAuthUser = {
  sub: "github|dev_user_1",
  name: "Developer",
  nickname: "developer",
  email: "developer@tessera.local",
  picture: "https://avatars.githubusercontent.com/u/583231?v=4",
};

/**
 * Creates Express router handling GitHub OAuth endpoints.
 */
export function createAuthRouter(config: AuthConfig = {}): Router {
  const router = Router();
  const clientId = config.clientId ?? process.env["GITHUB_CLIENT_ID"];
  const clientSecret = config.clientSecret ?? process.env["GITHUB_CLIENT_SECRET"];
  const isConfigured = Boolean(clientId && clientSecret);

  router.get("/config", (_req: Request, res: Response) => {
    res.json({
      configured: isConfigured,
      clientId: clientId ?? null,
    });
  });

  router.post("/github", async (req: Request, res: Response) => {
    const { code, mock } = req.body ?? {};

    // Mock / dev fallback when unconfigured or explicitly requested in development
    if (mock || !isConfigured) {
      res.json({
        user: MOCK_DEV_USER,
        accessToken: "mock_github_access_token",
        isDevFallback: !isConfigured,
      });
      return;
    }

    if (typeof code !== "string" || code.trim().length === 0) {
      res.status(400).json({
        error: "Missing or invalid authorization code",
      });
      return;
    }

    try {
      const { accessToken } = await exchangeGitHubCode(code, clientId!, clientSecret!);
      const { user, primaryEmail } = await fetchGitHubProfile(accessToken);
      const normalizedUser = normalizeGitHubUser(user, primaryEmail);

      res.json({
        user: normalizedUser,
        accessToken,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "GitHub authentication failed";
      res.status(400).json({
        error: message,
      });
    }
  });

  return router;
}
