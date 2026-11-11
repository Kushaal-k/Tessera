import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { SEOHead } from "../components/seo/SEOHead.js";
import { useAuth } from "../auth/index.js";
import { OAUTH_STATE_KEY, OAUTH_RETURN_KEY } from "../auth/AuthProvider.js";
import type { AuthUser } from "../auth/types.js";

const SYNC_SERVER_URL =
  import.meta.env.VITE_SYNC_SERVER_URL ??
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "");

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const executedRef = useRef(false);

  useEffect(() => {
    if (executedRef.current) {
      return;
    }
    executedRef.current = true;

    async function handleExchange() {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        setErrorMessage(errorDescription || error || "GitHub authorization was cancelled or denied");
        return;
      }

      if (!code) {
        setErrorMessage("No authorization code was provided by GitHub");
        return;
      }

      const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
      if (expectedState && state && state !== expectedState) {
        setErrorMessage("OAuth state mismatch. The authentication request may have been forged.");
        return;
      }

      try {
        const endpoint = `${SYNC_SERVER_URL}/api/auth/github`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        if (!res.ok) {
          const contentType = res.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            const errData = (await res.json()) as { error?: string };
            throw new Error(errData.error || "Authentication failed. Please try again.");
          }
          throw new Error("Unable to connect to the authentication service. Please try again in a moment.");
        }

        const data = (await res.json()) as {
          user?: AuthUser;
          accessToken?: string;
          error?: string;
        };

        if (!data.user) {
          throw new Error(data.error || "Authentication completed but no user profile was returned");
        }

        // Commit active session to React state and persistent storage
        setSession({
          user: data.user,
          accessToken: data.accessToken,
        });

        // Clean up temporary OAuth parameters
        sessionStorage.removeItem(OAUTH_STATE_KEY);
        const returnTo = sessionStorage.getItem(OAUTH_RETURN_KEY) || "/sandbox";
        sessionStorage.removeItem(OAUTH_RETURN_KEY);

        // Transition smoothly to target workspace
        navigate(returnTo, { replace: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to exchange GitHub authorization code";
        setErrorMessage(message);
      }
    }

    void handleExchange();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center px-4 font-sans selection:bg-white/20 selection:text-white">
      <SEOHead
        title="Authenticating — Tessera"
        description="Authenticating session with GitHub."
        noindex={true}
      />

      <div className="w-full max-w-sm rounded-lg border border-white/[0.08] bg-[#0c0c0e] p-8 text-center space-y-5">
        {errorMessage ? (
          <>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-red-500/20 bg-red-950/30 text-red-400">
              <AlertCircle className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-sm font-medium text-zinc-100">
                Authentication Failed
              </h1>
              <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed break-words">
                {errorMessage}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                to="/sandbox"
                className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-zinc-100 px-3 text-xs font-medium text-zinc-950 hover:bg-white transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Try again</span>
              </Link>
              <Link
                to="/"
                className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900/60 px-3 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to homepage</span>
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-zinc-900 text-zinc-300">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
            </div>

            <div>
              <h1 className="text-sm font-medium text-zinc-100">
                Verifying GitHub account…
              </h1>
              <p className="mt-1 text-xs text-zinc-400">
                Finalizing credentials and redirecting to your workspace.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthCallbackPage;
