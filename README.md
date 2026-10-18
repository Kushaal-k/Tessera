# Tessera

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Tessera is an open-source collaborative development sandbox. It combines a browser-based Monaco editor, a shared file explorer, interactive terminals, and Docker-based code execution.

The project uses React and Vite for the frontend, Yjs and Socket.IO for collaboration, and a Node.js execution engine for terminal sessions and queued execution jobs.

## Core features

- **Collaborative editing:** synchronize document changes and participant awareness through Yjs and Socket.IO.
- **Workspace files:** create, rename, move, and delete files and folders in a shared explorer.
- **Multi-file editing:** switch between open tabs with a separate text buffer for each file.
- **Interactive terminals:** use a container shell with terminal resizing, restart, clear, and copy controls.
- **Filesystem synchronization:** exchange source-file and folder changes between the editor and terminal filesystem.
- **Batch execution:** submit workspace files to a BullMQ worker and receive standard output, errors, exit status, and execution duration.
- **Resizable layout:** adjust the explorer, editor, and terminal/output panels.

Dependency directories such as `node_modules`, `.git`, and build caches are excluded from source synchronization.

## How the services fit together

| Workspace | Responsibility |
| --- | --- |
| `apps/web` | React, Vite, Monaco, file explorer, and terminal UI |
| `apps/sync-server` | Collaboration rooms, Yjs synchronization, awareness, and execution queue submission |
| `apps/execution-engine` | Docker containers, terminal connections, source filesystem synchronization, and execution workers |
| `apps/ai-service` | Optional Python service containing RAG and MCP endpoints |
| `packages/shared-types` | Shared service contracts and workspace types |
| `packages/collaboration` | Yjs workspace model and collaboration provider |
| `packages/ui-components` | Shared React components |

The browser connects to the sync server for editing and to the execution engine for terminals. The sync server queues batch jobs in Redis; the execution worker runs them in separate containers and returns results. Filesystem work and Docker lifecycle management belong to the execution engine.

## Local setup

Run the core stack on Linux or inside WSL 2. On Windows, keep the repository and development tools in WSL and enable Docker Desktop integration for that distribution.

### Prerequisites

- Node.js 20 or later and npm 10 or later, as declared in `package.json`.
- Docker Engine or Docker Desktop with a running daemon accessible from the development shell.
- Docker Compose for the local Redis service.

The core editor, sync server, and execution engine do not require Python or MongoDB.

### Install and start

Clone the repository and install the locked dependencies:

```bash
git clone https://github.com/Kushaal-k/Tessera.git
cd Tessera
npm ci
```

Start Redis and prepare the terminal image:

```bash
docker compose up -d redis
docker pull node:20-slim
```

Start the three core applications from the repository root:

```bash
npx turbo run dev --filter=@tessera/web --filter=@tessera/sync-server --filter=@tessera/execution-engine
```

Turborepo builds the shared TypeScript packages before starting their consumers. Keep this command running while using the application.

| Service | Default address |
| --- | --- |
| Web application | http://localhost:3000 |
| Sync server | http://localhost:4000 |
| Execution engine and terminal namespace | http://localhost:4002 and `/terminal` |
| Redis | `127.0.0.1:6379` |

Open http://localhost:3000. Create a file, edit it, and use the terminal to confirm the corresponding source exists in the workspace. Terminal file changes should also appear in the explorer.

Use Ctrl+C to stop the development processes. To stop the local Redis container:

```bash
docker compose stop redis
```

### Configuration

The setup above uses the services' built-in defaults. `.env.example` lists configuration variables, but the Node.js services do not automatically load a root `.env` file.

For custom server settings, provide environment variables to the service process. Turborepo uses strict environment filtering, so explicitly configure forwarding or launch the workspace scripts directly after building their shared dependencies. Vite reads frontend environment files from `apps/web`.

The execution engine expects the Docker socket at `/var/run/docker.sock` by default. If running the worker inside a container, workspace bind-mount paths must also exist on the Docker daemon host. See [Docker sandbox troubleshooting](docs/docker-sandbox-troubleshooting.md) for Docker access and WSL mount guidance.

## Execution behavior

Interactive terminals and the Run action serve different purposes:

- **Terminal:** runs commands in a workspace container, including package installation and long-running development processes.
- **Run:** sends a file set and entrypoint to an isolated batch job, with a time limit and collected output.

Batch runner definitions currently exist for TypeScript, Python, C++, Java, Rust, and Go in `apps/execution-engine/src/sandbox.ts`. Editor highlighting also covers other file types; highlighting alone does not make a file executable.

TypeScript currently uses a Node 20 image without a TypeScript compilation step, and JavaScript is not a separate batch runtime key. Typed TypeScript and JavaScript Run behavior therefore have known gaps. Terminal execution follows the commands and dependencies available inside its container.

The current application uses a default collaboration room. Room documents are kept in memory, so editor synchronization does not provide durable saving across server restarts. Workspace files on disk have a separate lifecycle.

## Development checks

The repository's quality gate runs:

```bash
npx turbo run lint typecheck test build
```

This includes the optional Python workspace. To prepare it in Linux or WSL:

```bash
python3 -m venv apps/ai-service/.venv
source apps/ai-service/.venv/bin/activate
pip install -r apps/ai-service/requirements.txt -r apps/ai-service/requirements-dev.txt
```

Python 3.11 or later is required for that service and its checks. MongoDB is needed when running the optional service:

```bash
docker compose up -d mongo
npm run dev
```

With the virtual environment active, `npm run dev` starts all applications, including the Python service on port 8000. The filtered core command above leaves it out.

## Working on Tessera

Use [the issue tracker](https://github.com/Kushaal-k/Tessera/issues) to track work. See [CONTRIBUTING.md](CONTRIBUTING.md) for branch, validation, and pull request guidance.

Pull requests run the quality gate, with additional sandbox verification for execution-engine changes. File-based PR labels and container publishing remain automated; issue assignments are managed manually.

## License

Tessera is released under the [MIT License](LICENSE).
