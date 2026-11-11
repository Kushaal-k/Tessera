import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { AuthContextValue, AuthSessionData, AuthUser } from "./types.js";

const AuthContext = createContext<AuthContextValue | null>(null);

export const AUTH_STORAGE_KEY = "tessera:auth_session";
export const OAUTH_STATE_KEY = "tessera:oauth_state";
export const OAUTH_RETURN_KEY = "tessera:oauth_return_to";

const STATIC_CLIENT_ID = (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined)?.trim() ?? "";

const MOCK_DEV_USER: AuthUser = {
  sub: "github|dev_user_1",
  name: "Developer",
  nickname: "developer",
  email: "developer@tessera.local",
  picture: "https://avatars.githubusercontent.com/u/583231?v=4",
};

export interface AuthProviderProps {
  readonly children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [serverClientId, setServerClientId] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthSessionData;
        if (parsed?.user) {
          return parsed.user;
        }
      }
    } catch {
      // Ignore parse failure on initial read
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Discover GitHub OAuth client ID dynamically from sync-server if not provided at build time
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const res = await fetch("/api/auth/config");
        if (res.ok) {
          const data = (await res.json()) as { configured: boolean; clientId: string | null };
          if (isMounted && data.clientId) {
            setServerClientId(data.clientId);
          }
        }
      } catch {
        // Silently fall back to build-time environment variable
      }
    }

    void loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeClientId = STATIC_CLIENT_ID || serverClientId;
  const isConfigured = Boolean(activeClientId);

  const setSession = useCallback((session: AuthSessionData | null) => {
    if (session?.user) {
      setUser(session.user);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      } catch {
        // Ignore storage error
      }
    } else {
      setUser(null);
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // Ignore storage error
      }
    }
  }, []);

  // If a mock developer session exists from earlier testing but GitHub OAuth is now configured,
  // automatically evict the mock session so the user is prompted to sign in with GitHub.
  useEffect(() => {
    if (isConfigured && user?.sub === "github|dev_user_1") {
      setSession(null);
    }
  }, [isConfigured, user?.sub, setSession]);

  // Sync across browser tabs if session changes in another window
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === AUTH_STORAGE_KEY) {
        if (!event.newValue) {
          setUser(null);
        } else {
          try {
            const parsed = JSON.parse(event.newValue) as AuthSessionData;
            setUser(parsed.user ?? null);
          } catch {
            setUser(null);
          }
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const login = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    if (activeClientId) {
      try {
        const state = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15);

        sessionStorage.setItem(OAUTH_STATE_KEY, state);
        sessionStorage.setItem(OAUTH_RETURN_KEY, window.location.pathname);

        const redirectUri = `${window.location.origin}/auth/callback`;
        const params = new URLSearchParams({
          client_id: activeClientId,
          redirect_uri: redirectUri,
          scope: "read:user user:email",
          state,
        });

        window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
        return;
      } catch (err: unknown) {
        setIsLoading(false);
        const message = err instanceof Error ? err.message : "Failed to initiate GitHub authorization";
        setError(message);
        return;
      }
    }

    // Fallback: local developer authentication
    await new Promise((resolve) => setTimeout(resolve, 150));
    setSession({ user: MOCK_DEV_USER, accessToken: "mock_token" });
    setIsLoading(false);
  }, [activeClientId, setSession]);

  const logout = useCallback(() => {
    setSession(null);
    setError(null);
  }, [setSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(user),
      isLoading,
      user,
      login,
      logout,
      setSession,
      isConfigured,
      error,
    }),
    [user, isLoading, login, logout, setSession, isConfigured, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
