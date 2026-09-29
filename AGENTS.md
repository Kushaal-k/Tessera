# Tessera Development Guidelines & Project Guardrails

## 1. Core Engineering Philosophy
- **Maintainer Comprehension First**: Code must always remain understandable to the project maintainer. Avoid convoluted abstractions, unnecessary wrappers, or complex metaprogramming.
- **Architectural Improvements with Purpose**: When refining existing prototypes, maintain the established mental model (e.g., flat Yjs maps for files/folders, per-file Y.Text buffers) while making necessary robustness improvements (Y.Doc injection, atomic `doc.transact()` updates, cycle prevention, type safety). Explain the rationale for any non-obvious design choice.
- **Issue-Focused Scope**: Strictly restrict changes to the active issue's acceptance criteria. Do not implement features from subsequent roadmap issues ahead of time.

## 2. Code Style & Documentation
- **Professional & Minimal Comments**: Keep comments concise, standard, and focused. Do not use decorative ASCII borders (such as `// ────`), redundant explanations of obvious code, or verbose banners.
- **Explicit Control Flow Braces**: Always use explicit curly braces `{ ... }` for all control flow statements (`if`, `else`, `for`, `while`). Never omit braces or inline statements to reduce line count; prioritize low cognitive load and clear readability over dense code golfing.
- **No Issue Number Annotations in Code/Tests**: Never reference issue numbers (e.g., `// Issue #515`, `describe("Issue 515 - ...")`) in source code, comments, or unit test descriptions. Keep test suites and code comments strictly focused on functionality and domain behavior.
- **Shared Type Centralization**: Common DTOs, entity interfaces, and contracts belong in `@tessera/shared-types` so frontend, sync-server, and collaboration packages remain unified.
- **Direct & Template-Free Task Tracking**: Keep backlog items and GitHub issue definitions concise, direct, and actionable. Avoid bureaucratic form templates; clearly specify target packages/files, a 1–2 sentence problem summary, and actionable checkboxed acceptance criteria. Never add `level:` labels (`level:beginner`, `level:advanced`, etc.) to GitHub issues.
- **Legacy Issue Cutoff**: Do not reference or work on legacy issues older than `#510`; focus exclusively on the active modern engineering backlog (`#520+`).

## 3. Git & File Management Rules
- **Explicit Push & Commit Only**: Never create commits or push to remote branches unless explicitly asked by the user.
- **Branch Naming**: Branch names should clearly state the feature or issue being addressed (e.g., `implement-workspace-model`).
- **Stacked PR Continuity**: When working on sequential features, stack branches cleanly against the immediate parent feature branch. Verify whether active PRs already satisfy subsequent issues before creating redundant branches or duplicate issues.
- **Rebasing after Parent Merge**: When a parent PR is merged into `main` on GitHub, rebase the child branch cleanly onto `origin/main` (`git rebase --onto origin/main <parent-commit> <child-branch>`) before pushing with `--force-with-lease`.
- **Protected Files**:
  - `tessera_master_plan.md` must **never** be committed or pushed anywhere.
  - Do **not** add `tessera_master_plan.md` to `.gitignore`.
  - Do **not** delete `tessera_master_plan.md`.

## 4. Monorepo Quality & CI
- **Gatekeeper Verification**: The monorepo CI runs `turbo run lint typecheck test build` across all workspaces. Ensure:
  - TypeScript packages pass typechecking and builds (`tsc --noEmit`, `tsc -p tsconfig.build.json`).
  - Unit tests run and pass (`vitest`).
  - Python services (`apps/ai-service`) adhere to Ruff linting (`ruff check .`, `ruff format --check .`) and import sorting (`I001`). Intentional broad exceptions in health check probes require `# noqa: BLE001`.
- **TypeScript Package Scoping**: Root `tsconfig.json` targets the ECMAScript standard library (`"lib": ["ES2022"]`). UI packages requiring browser DOM globals (e.g., `@tessera/ui-components`) must explicitly declare `"lib": ["ES2022", "DOM", "DOM.Iterable"]` in their `tsconfig.json` and `tsconfig.build.json`.
