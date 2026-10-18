# Contributing to Tessera

## Issues

Search the existing issues before opening a new one. For a bug, include reproduction steps, expected and actual behavior, and relevant environment details. For an enhancement, describe the problem and the intended behavior.

Issue assignments are managed manually on GitHub. Pick an open issue and check for related pull requests before starting.

## Local setup

Follow the [README](README.md#local-setup) to install dependencies and start the core services. Prepare the Python environment described under [development checks](README.md#development-checks) before running the full quality gate.

Create a branch for the change:

```bash
git switch -c codex/describe-your-change
```

If you do not have write access to the repository, fork it and push your branch to the fork.

## Making changes

Keep each change focused on the issue it addresses. Follow the existing implementation and keep the code understandable.

- Put shared service contracts and workspace types in `packages/shared-types`.
- Keep Yjs synchronization and awareness in `apps/sync-server`.
- Keep Docker containers, terminals, and filesystem synchronization in `apps/execution-engine`.
- Exclude dependency directories and build caches from editor documents.
- Add regression coverage for changed hooks, services, and synchronization behavior.

Run the quality gate from the repository root:

```bash
npx turbo run lint typecheck test build
```

Manually verify changes that affect the editor, terminal, or filesystem. Include screenshots or a short recording for visible UI changes when useful.

## Pull requests

Use a clear commit message that describes the change, such as `fix: preserve terminal session ownership` or `docs: clarify local setup`.

Open a pull request with:

- The problem and resulting behavior.
- Relevant issue references.
- Validation performed and any remaining limitations.

The quality gate and relevant sandbox checks run automatically. Pull requests receive file-based labels automatically.

## Adding a language

1. Define the runtime contract in `packages/shared-types`, keeping editor language identifiers separate from runtime support.
2. Add the image, entrypoint, and execution command in `apps/execution-engine/src/sandbox.ts`.
3. Update extension detection in `packages/collaboration/src/workspace.ts` and the relevant frontend runtime controls.
4. Verify real container execution, compiler/runtime failures, and multi-file behavior.
5. Add completion providers only when required by the change.
