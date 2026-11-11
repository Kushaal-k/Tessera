import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { primaryButtonClass } from "./marketingClasses.js";

export function MarketingCta({
  title,
  body,
}: {
  readonly title: string;
  readonly body: string;
}) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-white/[0.08] bg-[#09090b] px-6 py-8 sm:flex-row sm:items-center sm:px-8">
        <div className="max-w-lg">
          <h2 className="text-xl font-medium tracking-tight text-zinc-50">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
        </div>
        <Link to="/sandbox" className={`${primaryButtonClass} shrink-0`}>
          <span>Open sandbox</span>
          <ArrowRight className="h-4 w-4 text-zinc-700" />
        </Link>
      </div>
    </section>
  );
}
