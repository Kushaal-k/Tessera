import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage.js";
import { FeaturesPage } from "./pages/FeaturesPage.js";
import { DocsPage } from "./pages/DocsPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { AuthCallbackPage } from "./pages/AuthCallbackPage.js";
import { Loader2 } from "lucide-react";

const SandboxPage = lazy(() => import("./pages/SandboxPage.js"));

function SandboxLoadingFallback() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-black text-zinc-400 select-none">
      <Loader2 className="h-7 w-7 animate-spin text-zinc-300" />
      <p className="text-xs font-medium text-zinc-300">
        Loading Tessera collaborative workspace…
      </p>
    </div>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/sandbox"
        element={
          <Suspense fallback={<SandboxLoadingFallback />}>
            <SandboxPage />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
