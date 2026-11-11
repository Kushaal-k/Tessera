import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ArrowRight, LogOut } from "lucide-react";
import { BrandMark } from "./BrandMark.js";
import { GitHubIcon } from "./GitHubIcon.js";
import { primaryButtonClass } from "./marketingClasses.js";
import { useAuth } from "../../auth/index.js";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function headerVeil(feather: number, solid: number): number {
  if (solid >= 0.995) {
    return 1;
  }
  return Math.max(feather, solid);
}

function linkClass(isActive: boolean): string {
  const base =
    "rounded-md px-2 py-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400";
  if (isActive) {
    return `${base} text-zinc-50`;
  }
  return `${base} text-zinc-500 hover:text-zinc-200`;
}

export function MarketingNav() {
  const { isAuthenticated, user, login, logout, isLoading } = useAuth();
  const [chrome, setChrome] = useState({ feather: 0, solid: 0 });

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const feather = Math.round(clamp01((y - 40) / (120 - 40)) * 100) / 100;
      const solid = Math.round(clamp01((y - 520) / (700 - 520)) * 100) / 100;
      setChrome((current) => {
        if (current.feather === feather && current.solid === solid) {
          return current;
        }
        return { feather, solid };
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const veil = headerVeil(chrome.feather, chrome.solid);

  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className="relative"
        style={{ background: `rgba(0, 0, 0, ${veil})` }}
      >
      <div className="relative mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <NavLink to="/" className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400" end>
          <BrandMark className="h-5 w-5 shrink-0" />
          <span className="flex items-baseline gap-0.5 text-sm font-medium tracking-tight text-zinc-100">
            <span>Tessera</span>
            <span className="font-mono text-xs text-zinc-500">.io</span>
          </span>
        </NavLink>

        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <NavLink to="/features" className={({ isActive }) => linkClass(isActive)}>
            Features
          </NavLink>
          <NavLink to="/docs" className={({ isActive }) => linkClass(isActive)}>
            Docs
          </NavLink>
          <a
            href="https://github.com/Kushaal-k/Tessera"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-md px-2 py-1 text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 sm:inline-block"
          >
            GitHub
          </a>

          {!isLoading && (
            <>
              {isAuthenticated ? (
                <div className="hidden sm:flex items-center gap-2 border-l border-white/[0.08] pl-2 ml-1">
                  {user?.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name || "User"}
                      className="h-6 w-6 rounded-full object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-300">
                      {(user?.name || user?.nickname || "U").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs text-zinc-400 max-w-[100px] truncate">
                    {user?.name || user?.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => logout()}
                    title="Sign out"
                    aria-label="Sign out"
                    className="rounded p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => login()}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                >
                  <GitHubIcon className="h-3.5 w-3.5 text-zinc-300" />
                  <span>Sign in</span>
                </button>
              )}
            </>
          )}

          <NavLink to="/sandbox" className={`${primaryButtonClass} ml-1 h-8 shrink-0 whitespace-nowrap px-2.5 text-xs sm:ml-2 sm:px-3 sm:text-sm`}>
            <span className="sm:hidden">Sandbox</span>
            <span className="hidden sm:inline">Open sandbox</span>
            <ArrowRight className="hidden h-3.5 w-3.5 text-zinc-700 sm:block" />
          </NavLink>
        </nav>
      </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-full h-8"
          style={{
            background: `linear-gradient(to bottom, rgba(0, 0, 0, ${veil}), rgba(0, 0, 0, 0))`,
          }}
        />
      </div>
    </header>
  );
}
