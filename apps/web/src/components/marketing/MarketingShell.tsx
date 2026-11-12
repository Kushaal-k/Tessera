import { useEffect, type ReactNode } from "react";
import { MarketingFooter } from "./MarketingFooter.js";
import { MarketingNav } from "./MarketingNav.js";

export function MarketingShell({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("no-scrollbar");
    return () => {
      document.documentElement.classList.remove("no-scrollbar");
    };
  }, []);

  return (
    <div className="relative flex min-h-screen w-full flex-1 flex-col bg-black font-sans text-zinc-100 selection:bg-white/20 selection:text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[60rem]"
        style={{
          background:
            "radial-gradient(ellipse 115% 95% at 0% 0%, rgba(99, 102, 241, 0.4), rgba(99, 102, 241, 0.14) 48%, transparent 82%)",
        }}
      />
      <MarketingNav />
      <main className="marketing-rise relative flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
