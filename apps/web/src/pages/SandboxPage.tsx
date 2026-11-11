import { SEOHead } from "../components/seo/SEOHead.js";
import { App as IDEWorkspace } from "../App.js";
import { useAuth } from "../auth/index.js";
import { Lock, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { MarketingNav } from "../components/marketing/MarketingNav.js";
import { MarketingFooter } from "../components/marketing/MarketingFooter.js";
import { GitHubIcon } from "../components/marketing/GitHubIcon.js";

export function SandboxPage() {
  const { isAuthenticated, isLoading, login, isConfigured } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-[#09090b] text-zinc-400 select-none">
        <Loader2 className="h-7 w-7 animate-spin text-zinc-300" />
        <p className="text-xs font-medium text-zinc-300">
          Authenticating session…
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-white/20 selection:text-white">
        <SEOHead
          title="Sign in — Tessera Sandbox"
          description="Authenticate to launch your collaborative code workspace."
          canonical="https://tesserabuild.tech/sandbox"
          noindex={true}
        />
        <MarketingNav />

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
          <div className="w-full max-w-sm rounded-lg border border-white/[0.08] bg-[#0c0c0e] p-8 text-left space-y-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-zinc-900 text-zinc-300">
              <Lock className="h-4 w-4" />
            </div>

            <div>
              <h1 className="text-base font-medium text-zinc-100">
                Sign in to Tessera Sandbox
              </h1>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                Authentication is required to launch collaborative rooms, edit code buffers, and execute Docker containers.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => login()}
                className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-100 px-4 text-xs font-medium text-zinc-950 transition-colors hover:bg-white cursor-pointer"
              >
                <GitHubIcon className="h-4 w-4 text-zinc-950" />
                <span>
                  {isConfigured || !import.meta.env.DEV
                    ? "Sign in with GitHub"
                    : "Continue with GitHub (dev mode)"}
                </span>
              </button>

              <Link
                to="/"
                className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900/60 px-3 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to homepage</span>
              </Link>
            </div>

            {import.meta.env.DEV && !isConfigured && (
              <p className="text-[11px] text-zinc-500 border-t border-white/[0.06] pt-4 leading-relaxed">
                GitHub OAuth client ID is not configured in <code className="font-mono text-zinc-400">.env</code>; continuing activates local developer authentication.
              </p>
            )}
          </div>
        </main>

        <MarketingFooter />
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Tessera Sandbox — Collaborative Workspace"
        description="Real-time collaborative developer workspace with Monaco code editor, live terminal, and Docker container execution."
        canonical="https://tesserabuild.tech/sandbox"
        noindex={true}
      />
      <IDEWorkspace />
    </>
  );
}

export default SandboxPage;
