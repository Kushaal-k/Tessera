import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { HeroWash } from "../components/marketing/HeroWash.js";
import { MarketingShell } from "../components/marketing/MarketingShell.js";
import { primaryButtonClass, secondaryButtonClass } from "../components/marketing/marketingClasses.js";
import { SEOHead } from "../components/seo/SEOHead.js";

const suggestions = [
  { to: "/features", label: "Features" },
  { to: "/docs", label: "Docs" },
  { to: "/sandbox", label: "Sandbox" },
] as const;

export function NotFoundPage() {
  return (
    <MarketingShell>
      <SEOHead
        title="Page Not Found — Tessera"
        description="The requested page could not be found on Tessera."
        noindex={true}
      />

      <HeroWash className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-24 sm:px-6">
        <p className="font-mono text-sm tracking-[0.18em] text-indigo-300">404</p>
        <h1 className="mt-4 max-w-xl text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl">
          This page is not in the <span className="text-indigo-300">workspace</span>
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-zinc-400">
          The address does not match a Tessera page. Head home, or open the sandbox and keep going.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/" className={secondaryButtonClass}>
            <ArrowLeft className="h-4 w-4 text-zinc-400" />
            Return home
          </Link>
          <Link to="/sandbox" className={primaryButtonClass}>
            Open sandbox
          </Link>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {suggestions.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="text-zinc-400 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-100">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      </HeroWash>
    </MarketingShell>
  );
}
