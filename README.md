# Tessera

**A collaborative coding workspace in your browser.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Tessera brings a Monaco editor, shared files, and an interactive terminal into one workspace. Edit code together in real time, work with source files from the editor or terminal, and run code in Docker containers.

[Local setup](#local-setup) · [Try it out](#try-it-out) · [How it works](#how-it-works) · [Development](#development-checks) · [Troubleshooting](#troubleshooting)

## Core features

- **Live collaboration:** shared editing, participant presence, and cursors powered by Yjs and Socket.IO.
- **Files and folders:** create, rename, move, and delete items in a shared explorer, with separate editor buffers and tabs for each file.
- **Interactive terminals:** run shell commands in a workspace container, with resize, restart, clear, and copy controls.
- **Source synchronization:** changes to source files and folders flow between the editor and terminal filesystem. Dependency directories such as `node_modules`, `.git`, and build caches are excluded.
- **Code execution:** submit workspace files for a batch run and view output, errors, exit status, and execution duration.
- **Adjustable workspace:** resize panels and configure the editor's font size and minimap.

## Local setup

Use Linux or WSL 2. On Windows, keep the repository and development tools inside WSL and enable Docker Desktop integration for that distribution.

### Prerequisites

- Node.js **20+** and npm **10+**.
- Docker Engine or Docker Desktop, running and accessible from your development shell.
- Docker Compose for the local Redis service.

The core workspace runs without Python or MongoDB.

### Start the core services

Run these commands in your development shell:

```bash
git clone https://github.com/Kushaal-k/Tessera.git
cd Tessera
npm ci

docker compose up -d redis
docker pull node:20-slim

npx turbo run dev --filter=@tessera/web --filter=@tessera/sync-server --filter=@tessera/execution-engine
```

Turborepo builds the shared packages and starts the three core applications. Keep the process running, then open **[localhost:3000](http://localhost:3000)**.

| Service | Default address |
| --- | --- |
| Browser workspace | `http://localhost:3000` |
| Collaboration server | `http://localhost:4000` |
| Execution engine | `http://localhost:4002` (terminal namespace: `/terminal`) |
| Redis | `127.0.0.1:6379` |

### Try it out

1. Use **New File** in the explorer to create `hello.js`.
2. Add `console.log("Hello from Tessera");` in the editor.
3. In Tessera's terminal, run `node hello.js`. You should see `Hello from Tessera`.
4. Open the application in a second browser tab, select the same file, and edit it to see collaboration in action.
5. In the terminal, run `touch notes.txt`. The new file should appear in the shared explorer.

To try the **Run** action separately, create `main.py` containing `print("Hello from Tessera")`, select it, and click **Run**. Results appear in the output panel. The first run may take longer while Docker downloads the language image.

### Stop the services

Press `Ctrl+C` in the shell running the development processes. Stop Redis with:

```bash
docker compose stop redis
```

## Running code

| | Terminal | Run action |
| --- | --- | --- |
| Use it for | Shell commands, installing packages, and running development processes | Executing the selected file with the workspace's source files |
| Environment | Workspace container, using `node:20-slim` by default | Separate container selected by the batch runtime |
| Results | Interactive terminal output | Collected output, errors, exit status, and duration |

The [batch runner](apps/execution-engine/src/sandbox.ts) defines runtimes for TypeScript, Python, C++, Java, Rust, and Go. Editor syntax highlighting covers additional file types; runtime support is separate.

### Current limitations

- **Shared room:** the application currently connects to one default collaboration room.
- **Saving:** collaboration documents are held in server memory. Synchronization does not guarantee durable saving across server restarts; files on disk have a separate lifecycle.
- **JavaScript and TypeScript runs:** JavaScript has no separate batch runtime key, and the TypeScript runner uses Node 20 without a compilation step. Use the terminal for JavaScript, as in the walkthrough above; typed TypeScript needs an appropriate toolchain.

## How it works

The React and Vite frontend connects to the sync server for shared editing and to the execution engine for terminals. Yjs manages collaborative document state; Socket.IO carries updates and terminal events. The sync server submits batch jobs through Redis and BullMQ, and the execution engine runs them in Docker and returns results.

| Directory | Responsibility |
| --- | --- |
| [`apps/web`](apps/web) | Browser UI, Monaco editor, file explorer, and xterm.js terminal |
| [`apps/sync-server`](apps/sync-server) | Collaboration rooms, document synchronization, participant awareness, and batch job submission |
| [`apps/execution-engine`](apps/execution-engine) | Docker lifecycle, terminal sessions, filesystem synchronization, and batch execution |
| [`packages/collaboration`](packages/collaboration) | Yjs workspace model and collaboration provider |
| [`packages/shared-types`](packages/shared-types) | Shared types and service contracts |
| [`packages/ui-components`](packages/ui-components) | Shared React components |

Docker and filesystem operations belong to the execution engine. The sync server handles collaboration independently of container management.

## Configuration

The quick start uses built-in local defaults. [`.env.example`](.env.example) lists service settings, but the Node.js services do **not** automatically load a root `.env` file.

- **Server settings:** supply environment variables to the service process. Turborepo filters environment variables by default, so custom settings need explicit forwarding or direct workspace startup after building shared dependencies.
- **Frontend settings:** Vite reads environment files from `apps/web`. The terminal endpoint supports `VITE_EXECUTION_ENGINE_URL`; the collaboration URL is currently defined in [`App.tsx`](apps/web/src/App.tsx).
- **Docker access:** the default socket is `/var/run/docker.sock`. Workspace bind-mount paths must be accessible to the Docker daemon, including when the execution engine itself runs in a container.

## Development checks

The full repository quality gate is:

```bash
npx turbo run lint typecheck test build
```

It checks all workspaces, including the optional Python service. Prepare that environment before running the full gate:

<details>
<summary>Python setup for repository-wide checks</summary>

Use Python 3.11 or later, then run from the repository root:

```bash
python3 -m venv apps/ai-service/.venv
source apps/ai-service/.venv/bin/activate
pip install -r apps/ai-service/requirements.txt -r apps/ai-service/requirements-dev.txt
```

Keep the virtual environment active when running the quality gate. The optional service lives in [`apps/ai-service`](apps/ai-service); it is excluded from the core startup command above. `npm run dev` starts every application and also requires that service's runtime dependencies, including MongoDB.

</details>

See [CONTRIBUTING.md](CONTRIBUTING.md) for development conventions and pull request guidance. Track bugs and active work in [GitHub Issues](https://github.com/Kushaal-k/Tessera/issues).

## Troubleshooting

- **Terminal fails to start:** check that `docker info` succeeds from your development shell and that `node:20-slim` has been pulled.
- **Batch runs fail or do not return results:** confirm Redis and the execution engine are running, then inspect their logs. A first run also needs access to download its Docker image.
- **Docker permission or WSL mount errors:** follow the [Docker sandbox troubleshooting guide](docs/docker-sandbox-troubleshooting.md).

## License

Tessera is released under the [MIT License](LICENSE).
