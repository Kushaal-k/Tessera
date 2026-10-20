import http from "node:http";
import crypto from "node:crypto";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import { Queue, QueueEvents } from "bullmq";
import type {
  Participant,
  SyncClientToServerEvents,
  SyncServerToClientEvents,
  ExecutionTask,
  ExecutionResult,
  ExecutionFile,
  SupportedLanguage,
} from "@tessera/shared-types";

import { createWorkspace } from "@tessera/collaboration";
import { registerDocumentSyncHandlers, extractBinaryPayload } from "./documentSync.js";

interface RoomState {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly participants: Map<string, Participant>;
}

const PORT = Number(process.env["PORT"] ?? 4000);
const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "http://localhost:3000";
const REDIS_HOST = process.env["REDIS_HOST"] ?? "127.0.0.1";
const REDIS_PORT = Number(process.env["REDIS_PORT"] ?? 6379);

const rooms = new Map<string, RoomState>();

function seedDefaultFiles(doc: Y.Doc): void {
  const workspace = createWorkspace(
    {
      id: "default-workspace",
      name: "Tessera Project",
    },
    doc,
  );

  if (workspace.getFiles().length === 0) {
    workspace.createFile("index.js", {
      initialContent: `// Welcome to Tessera.io!
console.log("Hello, world! Running on Tessera collaborative platform.");

function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("Developer"));
`,
    });

    workspace.createFile("server.js", {
      initialContent: `// Sample Server
import http from "node:http";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "running", timestamp: new Date().toISOString() }));
});

const PORT = 3000;
console.log(\`Server listening on port \${PORT}\`);
`,
    });
  }
}

function getOrCreateRoom(roomId: string): RoomState {
  const existing = rooms.get(roomId);
  if (existing) {
    return existing;
  }

  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  seedDefaultFiles(doc);
  const room: RoomState = { doc, awareness, participants: new Map() };
  rooms.set(roomId, room);
  return room;
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const server = http.createServer(app);

const io = new SocketIOServer<SyncClientToServerEvents, SyncServerToClientEvents>(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e8,
});

const connectionOptions = { host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null };
const QUEUE_NAME = "code-execution";

const executionQueue = new Queue<ExecutionTask>(QUEUE_NAME, { connection: connectionOptions });

// A single, shared QueueEvents instance is intentionally reused across all concurrent
// execute-code requests. BullMQ's QueueEvents opens a dedicated Redis connection, so
// creating one per request would exhaust the Redis connection pool under load.
// job.waitUntilFinished(queueEvents) correctly filters events by the specific job ID
// internally, so there is no risk of cross-job event mixups.
const queueEvents = new QueueEvents(QUEUE_NAME, { connection: connectionOptions });

const MAX_ROOM_ID_LENGTH = 128;
const MAX_PARTICIPANT_ID_LENGTH = 128;
const MAX_PARTICIPANT_NAME_LENGTH = 100;
const MAX_AWARENESS_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_CODE_PAYLOAD_BYTES = 1024 * 1024; // 1MB
const MAX_EXECUTION_FILES_COUNT = 100;
const MAX_EXECUTION_FILE_BYTES = 1024 * 1024; // 1MB

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

io.on("connection", (socket) => {
  let currentRoomId: string | null = null;
  let currentParticipant: Participant | null = null;

  socket.on("join-room", (rawPayload: unknown) => {
    if (!isRecord(rawPayload)) {
      socket.emit("sync-error", {
        code: "INVALID_JOIN_PAYLOAD",
        message: "join-room payload must be an object",
      });
      return;
    }

    const roomId = rawPayload["roomId"];
    if (typeof roomId !== "string" || roomId.trim().length === 0 || roomId.length > MAX_ROOM_ID_LENGTH) {
      socket.emit("sync-error", {
        code: "INVALID_JOIN_PAYLOAD",
        message: `roomId must be a non-empty string under ${MAX_ROOM_ID_LENGTH} characters`,
      });
      return;
    }

    const participant = rawPayload["participant"];
    if (!isRecord(participant)) {
      socket.emit("sync-error", {
        code: "INVALID_JOIN_PAYLOAD",
        message: "participant must be an object",
      });
      return;
    }

    const id = typeof participant["id"] === "string" && participant["id"].trim().length > 0
      ? participant["id"]
      : typeof participant["userId"] === "string" && participant["userId"].trim().length > 0
        ? participant["userId"]
        : null;

    if (!id || id.length > MAX_PARTICIPANT_ID_LENGTH) {
      socket.emit("sync-error", {
        code: "INVALID_JOIN_PAYLOAD",
        message: `participant.id must be a non-empty string under ${MAX_PARTICIPANT_ID_LENGTH} characters`,
      });
      return;
    }

    const displayName = typeof participant["displayName"] === "string" && participant["displayName"].trim().length > 0
      ? participant["displayName"]
      : typeof participant["name"] === "string" && participant["name"].trim().length > 0
        ? participant["name"]
        : null;

    if (!displayName || displayName.length > MAX_PARTICIPANT_NAME_LENGTH) {
      socket.emit("sync-error", {
        code: "INVALID_JOIN_PAYLOAD",
        message: `participant.displayName must be a non-empty string under ${MAX_PARTICIPANT_NAME_LENGTH} characters`,
      });
      return;
    }

    const cleanParticipant: Participant = {
      id,
      displayName,
      isAI: Boolean(participant["isAI"]),
      cursorColor: typeof participant["cursorColor"] === "string"
        ? participant["cursorColor"].slice(0, 50)
        : "#38bdf8",
    };

    const room = getOrCreateRoom(roomId);
    currentRoomId = roomId;
    currentParticipant = cleanParticipant;
    room.participants.set(socket.id, cleanParticipant);

    void socket.join(roomId);

    socket.emit("room-joined", {
      roomId,
      participants: Array.from(room.participants.values()),
    });

    try {
      const stateVector = Y.encodeStateVector(room.doc);
      socket.emit("sync-step-1", stateVector);
    } catch (err: unknown) {
      console.error(`join-room state vector error [room=${roomId}]:`, err);
    }
  });

  registerDocumentSyncHandlers(socket, () => {
    if (!currentRoomId) {
      return null;
    }
    const room = rooms.get(currentRoomId);
    return room ? { roomId: currentRoomId, doc: room.doc } : null;
  });

  socket.on("awareness-update", (data: unknown) => {
    if (!currentRoomId) {
      return;
    }
    const room = rooms.get(currentRoomId);
    if (!room) {
      return;
    }

    const binary = extractBinaryPayload(data, MAX_AWARENESS_PAYLOAD_BYTES);
    if (!binary) {
      socket.emit("sync-error", {
        code: "INVALID_AWARENESS_PAYLOAD",
        message: "awareness-update must be a non-empty binary payload under 2MB",
      });
      return;
    }

    try {
      applyAwarenessUpdate(room.awareness, binary, socket);
      socket.to(currentRoomId).emit("awareness-update", binary);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`awareness-update error [room=${currentRoomId}]:`, message);
      socket.emit("sync-error", {
        code: "APPLY_AWARENESS_ERROR",
        message: `Failed to apply awareness update: ${message}`,
      });
    }
  });

  socket.on("execute-code", async (rawPayload: unknown) => {
    const taskId = crypto.randomUUID();

    if (!currentRoomId) {
      socket.emit("execution-result", {
        taskId,
        status: "failed",
        stdout: "",
        stderr: "Cannot execute code without joining a room",
        exitCode: 1,
        durationMs: 0,
      });
      return;
    }

    if (!isRecord(rawPayload)) {
      socket.emit("execution-result", {
        taskId,
        status: "failed",
        stdout: "",
        stderr: "Invalid execution payload: must be a non-null object",
        exitCode: 1,
        durationMs: 0,
      });
      return;
    }

    const language = rawPayload["language"];
    if (typeof language !== "string" || language.trim().length === 0 || language.length > 64) {
      socket.emit("execution-result", {
        taskId,
        status: "failed",
        stdout: "",
        stderr: "Invalid execution payload: language must be a valid non-empty string",
        exitCode: 1,
        durationMs: 0,
      });
      return;
    }

    const code = rawPayload["code"];
    if (code !== undefined) {
      if (typeof code !== "string") {
        socket.emit("execution-result", {
          taskId,
          status: "failed",
          stdout: "",
          stderr: "Invalid execution payload: code must be a string",
          exitCode: 1,
          durationMs: 0,
        });
        return;
      }
      if (Buffer.byteLength(code, "utf-8") > MAX_CODE_PAYLOAD_BYTES) {
        socket.emit("execution-result", {
          taskId,
          status: "failed",
          stdout: "",
          stderr: "Execution code exceeds maximum allowed size (1MB)",
          exitCode: 1,
          durationMs: 0,
        });
        return;
      }
    }

    const files = rawPayload["files"];
    if (files !== undefined) {
      if (!Array.isArray(files)) {
        socket.emit("execution-result", {
          taskId,
          status: "failed",
          stdout: "",
          stderr: "Invalid execution payload: files must be an array",
          exitCode: 1,
          durationMs: 0,
        });
        return;
      }
      if (files.length > MAX_EXECUTION_FILES_COUNT) {
        socket.emit("execution-result", {
          taskId,
          status: "failed",
          stdout: "",
          stderr: `Invalid execution payload: files cannot exceed ${MAX_EXECUTION_FILES_COUNT} files`,
          exitCode: 1,
          durationMs: 0,
        });
        return;
      }
      for (const file of files) {
        if (!isRecord(file) || typeof file["path"] !== "string" || typeof file["content"] !== "string") {
          socket.emit("execution-result", {
            taskId,
            status: "failed",
            stdout: "",
            stderr: "Invalid execution payload: files must contain string path and content",
            exitCode: 1,
            durationMs: 0,
          });
          return;
        }
        if (Buffer.byteLength(file["content"], "utf-8") > MAX_EXECUTION_FILE_BYTES) {
          socket.emit("execution-result", {
            taskId,
            status: "failed",
            stdout: "",
            stderr: "Invalid execution payload: individual file exceeds size limit (1MB)",
            exitCode: 1,
            durationMs: 0,
          });
          return;
        }
      }
    }

    const entrypoint = typeof rawPayload["entrypoint"] === "string" ? rawPayload["entrypoint"] : undefined;

    try {
      const task: ExecutionTask = {
        id: taskId,
        code: typeof code === "string" ? code : undefined,
        files: Array.isArray(files) ? files as readonly ExecutionFile[] : undefined,
        entrypoint,
        language: language as SupportedLanguage,
        timeoutMs: 5000,
        roomId: currentRoomId,
        createdAt: new Date().toISOString(),
      };

      console.log(`[sync-server] enqueuing code execution ${taskId} [lang=${language}]`);
      const job = await executionQueue.add("execute", task, { jobId: taskId });

      const result = await job.waitUntilFinished(queueEvents);
      console.log(`[sync-server] execution ${taskId} finished`);
      socket.emit("execution-result", result as ExecutionResult);
    } catch (err: unknown) {
      console.error(`[sync-server] execution ${taskId} failed:`, err);
      socket.emit("execution-result", {
        taskId,
        status: "failed",
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        exitCode: 1,
        durationMs: 0,
      });
    }
  });

  socket.on("disconnect", () => {
    if (!currentRoomId) {
      return;
    }
    const room = rooms.get(currentRoomId);
    if (!room) {
      return;
    }

    try {
      room.participants.delete(socket.id);

      if (currentParticipant) {
        removeAwarenessStates(room.awareness, [room.awareness.clientID], socket);
      }

      if (room.participants.size === 0) {
        room.doc.destroy();
        rooms.delete(currentRoomId);
      }
    } catch (err: unknown) {
      console.error(`disconnect error [room=${currentRoomId}]:`, err);
    }
  });
});

server.listen(PORT, () => {
  console.log(`sync-server listening on :${String(PORT)}`);
});

async function gracefulShutdown() {
  console.log("shutting down sync-server…");
  try {
    await Promise.all([executionQueue.close(), queueEvents.close()]);
  } catch (err) {
    console.error("error closing bullmq handles:", err);
  }
  io.close();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", () => {
  void gracefulShutdown();
});
process.on("SIGINT", () => {
  void gracefulShutdown();
});
