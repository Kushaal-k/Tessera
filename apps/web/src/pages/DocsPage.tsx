import { Link } from "react-router-dom";
import { HeroWash } from "../components/marketing/HeroWash.js";
import { MarketingCta } from "../components/marketing/MarketingCta.js";
import { MarketingShell } from "../components/marketing/MarketingShell.js";
import { SEOHead } from "../components/seo/SEOHead.js";

const toc = [
  { href: "#quickstart", label: "Quickstart" },
  { href: "#assistant", label: "Tessera AI" },
  { href: "#terminal", label: "Terminal" },
  { href: "#shortcuts", label: "Shortcuts" },
] as const;

const steps = [
  {
    title: "Open the sandbox",
    body: (
      <>
        Go to{" "}
        <Link
          to="/sandbox"
          className="text-zinc-100 underline decoration-zinc-600 underline-offset-4 hover:decoration-zinc-300"
        >
          /sandbox
        </Link>
        . The client joins the collaborative room and syncs the files already in the workspace.
      </>
    ),
  },
  {
    title: "Set your display name",
    body: "Open the avatar in the header and enter a name. Peers see it on your cursor, and the browser keeps it for the next visit.",
  },
  {
    title: "Create a file and edit",
    body: "Use the explorer to add files or folders. Monaco highlights TypeScript, Python, C++, Rust, and Java, and offers language-aware completions.",
  },
  {
    title: "Run it in the container",
    body: (
      <>
        Press Run, or use{" "}
        <kbd className="rounded border border-white/[0.12] bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
          Cmd + Enter
        </kbd>
        . The active file executes inside the room’s Docker container.
      </>
    ),
  },
] as const;

const runtimes = [
  {
    language: "JavaScript / TypeScript",
    runtime: "Node.js 20",
    command: (
      <>
        <span className="text-indigo-300">node</span>
        <span className="text-zinc-400"> &lt;file&gt;</span>
      </>
    ),
  },
  {
    language: "Python",
    runtime: "Python 3.12",
    command: (
      <>
        <span className="text-indigo-300">python3</span>
        <span className="text-zinc-400"> -u &lt;file&gt;</span>
      </>
    ),
  },
  {
    language: "C++",
    runtime: "g++ 13",
    command: (
      <>
        <span className="text-indigo-300">g++</span>
        <span className="text-zinc-400"> -O2 &lt;file&gt; && ./a.out</span>
      </>
    ),
  },
  {
    language: "Rust",
    runtime: "rustc 1.78",
    command: (
      <>
        <span className="text-indigo-300">rustc</span>
        <span className="text-zinc-400"> &lt;file&gt; && ./main</span>
      </>
    ),
  },
] as const;

const shortcuts = [
  {
    action: "Execute code",
    shortcut: (
      <>
        <span className="text-indigo-300">Cmd + Enter</span>
        <span className="text-zinc-500"> / </span>
        <span className="text-indigo-300">Ctrl + Enter</span>
      </>
    ),
    where: "Global",
  },
  {
    action: "Rename item",
    shortcut: <span className="text-indigo-300">F2</span>,
    where: "Explorer",
  },
  {
    action: "Close tab",
    shortcut: (
      <>
        <span className="text-indigo-300">Middle click</span>
        <span className="text-zinc-400">, or the close icon</span>
      </>
    ),
    where: "Tab bar",
  },
  {
    action: "Reset a splitter",
    shortcut: (
      <>
        <span className="text-indigo-300">Double-click</span>
        <span className="text-zinc-400"> the handle</span>
      </>
    ),
    where: "Layout",
  },
] as const;

const tocLinkClass =
  "block rounded-md px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-100";

export function DocsPage() {
  return (
    <MarketingShell>
      <SEOHead
        title="Tessera Docs — Getting started with the sandbox"
        description="Documentation for Tessera collaborative cloud IDE. Learn how to create files, collaborate with peers, use the Docker terminal, and trigger Tessera AI."
        canonical="https://tesserabuild.tech/docs"
      />

      <HeroWash className="border-b border-indigo-400/10">
      <header className="mx-auto w-full max-w-5xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-indigo-300">Docs</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl sm:leading-[1.08]">
          Getting started with the <span className="text-indigo-300">sandbox</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Create files, name yourself for collaborators, run code in the container, and ask Tessera AI about the tab you have open.
        </p>
      </header>
      </HeroWash>

      <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="On this page" className="flex gap-2 overflow-x-auto lg:sticky lg:top-20 lg:block lg:h-fit lg:overflow-visible">
          {toc.map((item) => (
            <a key={item.href} href={item.href} className={`${tocLinkClass} shrink-0 lg:shrink`}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="min-w-0 space-y-16">
          <section id="quickstart" className="scroll-mt-24">
            <h2 className="text-2xl font-medium tracking-tight text-zinc-50">Quickstart</h2>
            <ol className="mt-8 space-y-8 border-l border-white/[0.08] pl-6">
              {steps.map((step, index) => (
                <li key={step.title} className="relative">
                  <span className="absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.12] bg-black font-mono text-[11px] text-zinc-300">
                    {index + 1}
                  </span>
                  <h3 className="text-base font-medium text-zinc-100">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section id="assistant" className="scroll-mt-24 border-t border-white/[0.08] pt-12">
            <h2 className="text-2xl font-medium tracking-tight text-zinc-50">Tessera AI</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Open the assistant from the header. It uses the active tab as context, so the prompt is about the file on screen.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <article className="rounded-xl border border-white/[0.08] bg-[#09090b] p-5">
                <h3 className="text-sm font-medium text-zinc-100">Explain the current file</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Ask for edge cases or a walkthrough of a function. The reply stays in the panel, formatted as Markdown.
                </p>
              </article>
              <article className="rounded-xl border border-white/[0.08] bg-[#09090b] p-5">
                <h3 className="text-sm font-medium text-zinc-100">Rewrite a snippet</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Ask to convert a callback to async/await or to add types. Copy the result back into the editor.
                </p>
              </article>
            </div>
          </section>

          <section id="terminal" className="scroll-mt-24 border-t border-white/[0.08] pt-12">
            <h2 className="text-2xl font-medium tracking-tight text-zinc-50">Terminal and runtimes</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Each room has its own container. Commands run as a non-root user, and the terminal is a live PTY rather than a captured log.
            </p>
            <div className="mt-6 overflow-x-auto rounded-xl border border-white/[0.08]">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="bg-[#101013] text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Language</th>
                    <th className="px-4 py-3 font-medium">Runtime</th>
                    <th className="px-4 py-3 font-medium">Run command</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] bg-[#09090b]">
                  {runtimes.map((row) => (
                    <tr key={row.language}>
                      <td className="px-4 py-3 text-zinc-100">{row.language}</td>
                      <td className="px-4 py-3 text-zinc-400">{row.runtime}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">{row.command}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="shortcuts" className="scroll-mt-24 border-t border-white/[0.08] pt-12">
            <h2 className="text-2xl font-medium tracking-tight text-zinc-50">Keyboard shortcuts</h2>
            <div className="mt-6 overflow-x-auto rounded-xl border border-white/[0.08]">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="bg-[#101013] text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Shortcut</th>
                    <th className="px-4 py-3 font-medium">Where</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] bg-[#09090b]">
                  {shortcuts.map((row) => (
                    <tr key={row.action}>
                      <td className="px-4 py-3 text-zinc-100">{row.action}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">{row.shortcut}</td>
                      <td className="px-4 py-3 text-zinc-500">{row.where}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <MarketingCta
        title="Open a workspace"
        body="The sandbox is the editor, terminal, and preview described above."
      />
    </MarketingShell>
  );
}
