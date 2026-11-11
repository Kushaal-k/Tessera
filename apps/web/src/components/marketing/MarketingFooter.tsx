import { Link } from "react-router-dom";
import { BrandMark } from "./BrandMark.js";

const linkClass =
  "text-sm text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400";

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-black">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-5 w-5" />
            <p className="text-sm font-medium text-zinc-100">Tessera</p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Collaborative cloud code editor with a shared Monaco workspace, live terminal, and web preview.
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Product</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link to="/features" className={linkClass}>
                Features
              </Link>
            </li>
            <li>
              <Link to="/sandbox" className={linkClass}>
                Sandbox
              </Link>
            </li>
            <li>
              <Link to="/docs" className={linkClass}>
                Documentation
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Project</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link to="/" className={linkClass}>
                Home
              </Link>
            </li>
            <li>
              <a
                href="https://github.com/Kushaal-k/Tessera"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
