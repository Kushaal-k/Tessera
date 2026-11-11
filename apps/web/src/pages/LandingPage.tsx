import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Code2,
  Cpu,
  Layers,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react";
import { HeroWash } from "../components/marketing/HeroWash.js";
import { MarketingCta } from "../components/marketing/MarketingCta.js";
import { MarketingShell } from "../components/marketing/MarketingShell.js";
import { primaryButtonClass, secondaryButtonClass } from "../components/marketing/marketingClasses.js";
import { SEOHead } from "../components/seo/SEOHead.js";

const features = [
  {
    icon: Users,
    title: "Real-time CRDT synchronization",
    body: "Conflict-free multi-user editing powered by Yjs. Collaborator cursors, awareness state, and file tree operations stay consistent without lockouts.",
    meta: "Awareness protocol · Y.Doc",
  },
  {
    icon: Bot,
    title: "Context-aware Tessera AI",
    body: "An assistant beside the editor that reads the active file. Generate functions, explain logic, and refactor without leaving the workspace.",
    meta: "Active file context · Streaming",
  },
  {
    icon: Terminal,
    title: "Containerized Docker terminal",
    body: "An interactive Linux sandbox with PTY streaming. Run scripts, install packages, and start servers in an isolated container.",
    meta: "WebSocket PTY · Node, Python, Rust",
  },
] as const;

const foundations = [
  {
    icon: Cpu,
    title: "Monaco editor",
    body: "VS Code editing foundations, with syntax highlighting, tabs, and familiar keybindings.",
  },
  {
    icon: ShieldCheck,
    title: "Isolated sandboxes",
    body: "Non-root containers with process limits and idle session teardown.",
  },
  {
    icon: Layers,
    title: "Nothing to install",
    body: "Opens in a modern browser. No local Docker engine or compiler required.",
  },
] as const;

export function LandingPage() {
  return (
    <MarketingShell>
      <SEOHead
        title="Tessera — Collaborative cloud code editor"
        description="Collaborative cloud IDE with a shared Monaco editor, live terminal, and web preview. Write and run code together in the browser."
        canonical="https://tesserabuild.tech/"
      />

      <HeroWash className="border-b border-indigo-400/10">
        <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-indigo-300">
          Collaborative IDE
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl sm:leading-[1.08]">
          Collaborative <span className="text-indigo-300">cloud</span> code editor
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          A shared Monaco editor, live terminal, and web preview. Write and run code together in the browser, with real-time CRDT sync and a containerized Docker runtime.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/sandbox" className={primaryButtonClass}>
            <Code2 className="h-4 w-4 text-zinc-800" />
            <span>Launch sandbox</span>
            <ArrowRight className="h-4 w-4 text-zinc-700" />
          </Link>
          <Link to="/features" className={secondaryButtonClass}>
            Explore features
          </Link>
        </div>

        <div className="mt-14 overflow-hidden rounded-xl border border-white/[0.08] bg-[#09090b]">
          <div className="flex h-11 items-center gap-3 border-b border-white/[0.08] bg-[#101013] px-3 sm:px-4">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            </div>
            <div className="ml-1 flex min-w-0 items-center gap-1">
              <span className="rounded-md bg-white/[0.06] px-2.5 py-1 font-mono text-[11px] text-zinc-100">
                server.ts
              </span>
              <span className="hidden px-2.5 py-1 font-mono text-[11px] text-zinc-500 sm:inline">
                schema.sql
              </span>
            </div>
            <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="marketing-live h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Synced
              </span>
              <span className="hidden items-center gap-1 sm:flex">
                <Users className="h-3 w-3 text-zinc-500" />
                2 peers
              </span>
            </div>
          </div>

          <div className="grid min-h-[320px] md:grid-cols-[148px_minmax(0,1.35fr)_minmax(0,1fr)]">
            <aside className="hidden border-r border-white/[0.08] bg-[#070709] p-3 md:block">
              <p className="px-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Explorer
              </p>
              <ul className="mt-2 space-y-0.5 font-mono text-[11px]">
                <li className="rounded-md bg-white/[0.06] px-2 py-1 text-zinc-100">server.ts</li>
                <li className="px-2 py-1 text-zinc-500">schema.sql</li>
                <li className="px-2 py-1 text-zinc-500">package.json</li>
              </ul>
            </aside>

            <div className="flex flex-col justify-between border-b border-white/[0.08] p-5 font-mono text-[13px] leading-6 text-zinc-300 md:border-b-0 md:border-r">
              <div>
                <p className="text-zinc-600">{"// Shared workspace"}</p>
                <p>
                  <span className="text-zinc-500">import</span> express{" "}
                  <span className="text-zinc-500">from</span>{" "}
                  <span className="text-zinc-200">&quot;express&quot;</span>;
                </p>
                <p>
                  <span className="text-zinc-500">const</span> app ={" "}
                  <span className="text-zinc-100">express</span>();
                </p>
                <p className="pt-3">
                  app.<span className="text-zinc-100">get</span>(
                  <span className="text-zinc-200">&quot;/api/session&quot;</span>, () =&gt; &#123;
                </p>
                <p className="pl-4">
                  <span className="border-l-2 border-indigo-400 pl-2 text-zinc-100">
                    status: &quot;live&quot;
                  </span>
                  <span className="ml-2 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] text-indigo-300">
                    Jordan
                  </span>
                </p>
                <p>&#125;);</p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-zinc-500">
                <span>TypeScript</span>
                <span className="inline-flex items-center gap-1.5">
                  <Bot className="h-3 w-3" />
                  Tessera AI
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-between bg-[#070709] p-5 font-mono text-[13px] leading-6 text-zinc-400">
              <div>
                <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-2 text-[11px] text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Terminal className="h-3 w-3" />
                    Sandbox PTY
                  </span>
                  <span>node:20-slim</span>
                </div>
                <p className="text-zinc-500">$ node --watch server.ts</p>
                <p className="text-zinc-200">[server] listening on port 5173</p>
                <p className="text-emerald-400/90">[preview] /preview/default-room/</p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-zinc-500">
                <span>114 MB / 512 MB</span>
                <span className="text-emerald-400/90">Running</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      </HeroWash>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-medium tracking-tight text-zinc-50">
            Pair <span className="text-indigo-300">programming</span>, without a local setup
          </h2>
          <p className="mt-3 text-base leading-relaxed text-zinc-400">
            The editor, terminal, preview, and assistant share one browser tab. Dependencies stay inside the container.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="flex flex-col rounded-xl border border-white/[0.08] bg-[#09090b] p-6 transition-colors hover:border-white/[0.16]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] bg-zinc-900 text-zinc-200">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-base font-medium text-zinc-100">{feature.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{feature.body}</p>
                <p className="mt-5 border-t border-white/[0.06] pt-4 font-mono text-[11px] text-zinc-500">
                  {feature.meta}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        <div className="grid overflow-hidden rounded-xl border border-white/[0.08] bg-[#09090b] md:grid-cols-3">
          {foundations.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`p-6 ${index > 0 ? "border-t border-white/[0.08] md:border-l md:border-t-0" : ""}`}
              >
                <Icon className="h-4 w-4 text-zinc-400" />
                <h3 className="mt-3 text-sm font-medium text-zinc-100">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <MarketingCta
        title="Start in the sandbox"
        body="Open a collaborative workspace immediately. No account or local configuration."
      />
    </MarketingShell>
  );
}
