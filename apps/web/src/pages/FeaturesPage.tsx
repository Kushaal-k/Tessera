import type { ReactNode } from "react";
import { Bot, Globe, Terminal, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { HeroWash } from "../components/marketing/HeroWash.js";
import { MarketingCta } from "../components/marketing/MarketingCta.js";
import { MarketingShell } from "../components/marketing/MarketingShell.js";
import { SEOHead } from "../components/seo/SEOHead.js";

interface FeatureSection {
  readonly id: string;
  readonly index: string;
  readonly short: string;
  readonly title: string;
  readonly body: string;
  readonly points: readonly string[];
  readonly icon: LucideIcon;
  readonly panelTitle: string;
  readonly panelStatus: string;
  readonly panelLines: readonly ReactNode[];
}

const sections: readonly FeatureSection[] = [
  {
    id: "collaboration",
    index: "01",
    short: "Collaboration",
    title: "Real-time CRDT synchronization",
    body: "Yjs keeps edits, cursors, and file-tree operations deterministic. Changes broadcast over a WebSocket room, so two people can type in the same file without a merge step.",
    points: [
      "Awareness tracks names, cursors, and the active file",
      "Workspace updates commit inside a single document transaction",
      "Your display name is stored in the browser for the next session",
    ],
    icon: Users,
    panelTitle: "Awareness",
    panelStatus: "Synced",
    panelLines: [
      <>
        <span className="text-zinc-500">{"{ "}</span>
        <span className="text-indigo-300">user</span>
        <span className="text-zinc-500">{": "}</span>
        <span className="text-emerald-300">&quot;usr_42&quot;</span>
        <span className="text-zinc-500">{", "}</span>
        <span className="text-indigo-300">name</span>
        <span className="text-zinc-500">{": "}</span>
        <span className="text-emerald-300">&quot;Jordan&quot;</span>
        <span className="text-zinc-500">{", "}</span>
        <span className="text-indigo-300">file</span>
        <span className="text-zinc-500">{": "}</span>
        <span className="text-emerald-300">&quot;server.ts&quot;</span>
        <span className="text-zinc-500">{" }"}</span>
      </>,
      <>
        <span className="text-zinc-200">doc</span>
        <span className="text-zinc-500">.</span>
        <span className="text-indigo-300">transact</span>
        <span className="text-zinc-500">{"(() => "}</span>
        <span className="text-zinc-200">workspace</span>
        <span className="text-zinc-500">.</span>
        <span className="text-indigo-300">setFileText</span>
        <span className="text-zinc-500">(</span>
        <span className="text-zinc-300">id</span>
        <span className="text-zinc-500">, </span>
        <span className="text-zinc-300">text</span>
        <span className="text-zinc-500">))</span>
      </>,
    ],
  },
  {
    id: "ai",
    index: "02",
    short: "Tessera AI",
    title: "Context-aware Tessera AI",
    body: "The assistant sits in a side panel and reads the tab you have open. Responses stream in as Markdown, with code you can copy back into the editor.",
    points: [
      "Language and file context travel with the prompt",
      "Suggested prompts cover explanations and tests",
      "Code blocks stay formatted for a direct paste",
    ],
    icon: Bot,
    panelTitle: "Assistant",
    panelStatus: "Streaming",
    panelLines: [
      <>
        <span className="text-indigo-300">&gt;</span>
        <span className="text-zinc-300"> Add an error boundary around the editor tab</span>
      </>,
      <>
        <span className="text-zinc-500">{"// "}</span>
        <span className="text-zinc-300">Wrapped the editor with a fallback render path</span>
      </>,
    ],
  },
  {
    id: "terminal",
    index: "03",
    short: "Terminal",
    title: "Containerized Docker terminal",
    body: "Compilers, package managers, and servers run in the room’s container. xterm.js streams a real PTY, and the panel resizes with the layout.",
    points: [
      "PTY streaming over WebSocket, with fit-to-panel resizing",
      "Node.js, Python, Rust, C++, and Java toolchains",
      "Memory caps and CPU quotas on the host process",
    ],
    icon: Terminal,
    panelTitle: "Execution engine",
    panelStatus: "PTY active",
    panelLines: [
      <>
        <span className="text-zinc-500">$ </span>
        <span className="text-indigo-300">npm</span>
        <span className="text-zinc-200"> test</span>
      </>,
      <>
        <span className="text-zinc-500">&gt; </span>
        <span className="text-indigo-300">vitest</span>
        <span className="text-zinc-300"> run</span>
      </>,
      <span className="text-emerald-400">14 tests passed</span>,
    ],
  },
  {
    id: "preview",
    index: "04",
    short: "Preview",
    title: "Live web preview",
    body: "Start a dev server in the container and Tessera proxies that port into the preview pane. The page you are building stays next to the editor.",
    points: [
      "Preview route follows the collaborative room",
      "Reload the pane after the server restarts",
      "Works with Vite, Next.js, and Express ports",
    ],
    icon: Globe,
    panelTitle: "Preview gateway",
    panelStatus: "Port 5173",
    panelLines: [
      <>
        <span className="text-indigo-300">GET</span>
        <span className="text-zinc-200"> /preview/default-room/</span>
        <span className="text-zinc-500"> → </span>
        <span className="text-emerald-300">container:5173</span>
      </>,
      <>
        <span className="text-zinc-500">HTTP </span>
        <span className="text-emerald-400">200</span>
        <span className="text-zinc-600"> · </span>
        <span className="text-zinc-300">text/html</span>
      </>,
    ],
  },
];

export function FeaturesPage() {
  return (
    <MarketingShell>
      <SEOHead
        title="Tessera Features — Real-time editor, terminal & AI"
        description="Explore Tessera features: real-time CRDT collaboration, Monaco editor, containerized Docker terminal, live web preview, and built-in AI code companion."
        canonical="https://tesserabuild.tech/features"
      />

      <HeroWash className="border-b border-indigo-400/10">
      <header className="mx-auto w-full max-w-5xl px-4 pb-8 pt-16 sm:px-6 sm:pt-20">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-indigo-300">Features</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl sm:leading-[1.08]">
          Real-time editor, <span className="text-indigo-300">terminal</span>, and AI
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          The collaborative cloud IDE is one workspace: shared editing, a container terminal, a live preview, and an assistant that sees the file you are in.
        </p>
        <nav aria-label="Feature sections" className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 rounded-full border border-white/[0.08] bg-[#09090b] px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-white/[0.16] hover:text-white"
            >
              <span className="mr-2 font-mono text-[11px] text-zinc-500">{section.index}</span>
              {section.short}
            </a>
          ))}
        </nav>
      </header>
      </HeroWash>

      <div className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <article
              key={section.id}
              id={section.id}
              className="grid scroll-mt-24 gap-8 border-t border-white/[0.08] py-12 lg:grid-cols-2 lg:items-start lg:py-16"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] bg-[#09090b] text-zinc-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-xs text-zinc-500">{section.index}</span>
                </div>
                <h2 className="mt-4 text-2xl font-medium tracking-tight text-zinc-50">
                  {section.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {section.body}
                </p>
                <ul className="mt-5 space-y-2.5 text-sm leading-relaxed text-zinc-300">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#070709]">
                <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5 font-mono text-[11px] text-zinc-500">
                  <span>{section.panelTitle}</span>
                  <span className="text-emerald-400/90">{section.panelStatus}</span>
                </div>
                <pre className="no-scrollbar overflow-x-auto p-4 font-mono text-[13px] leading-6">
                  {section.panelLines.map((line, index) => (
                    <div key={`${section.id}-${index}`}>{line}</div>
                  ))}
                </pre>
              </div>
            </article>
          );
        })}
      </div>

      <MarketingCta
        title="Try it in the sandbox"
        body="Open the editor, terminal, and preview together. No account required."
      />
    </MarketingShell>
  );
}
