// ─────────────────────────────────────────────────────────────
// @tessera/shared-types — Common TypeScript definitions & DTOs
// ─────────────────────────────────────────────────────────────

/**
 * Supported programming languages for code execution.
 */
export type SupportedLanguage = "typescript" | "python" | "cpp" | "go" | "java" | "rust";

/**
 * Status lifecycle of a code execution job.
 */
export type ExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "timeout";

/**
 * Payload submitted by a client to request code execution.
 */
export interface ExecutionTask {
  /** Unique identifier for this execution job. */
  readonly id: string;
  /** Source code to execute inside the sandbox. */
  readonly code: string;
  /** Language runtime to use. */
  readonly language: SupportedLanguage;
  /** Maximum execution duration in milliseconds. */
  readonly timeoutMs: number;
  /** ID of the collaboration room that initiated the task. */
  readonly roomId: string;
  /** ISO-8601 timestamp of when the task was submitted. */
  readonly createdAt: string;
}

/**
 * Result returned after a code execution job completes.
 */
export interface ExecutionResult {
  /** Matches the originating ExecutionTask.id. */
  readonly taskId: string;
  /** Final status of the execution. */
  readonly status: ExecutionStatus;
  /** Captured standard output. */
  readonly stdout: string;
  /** Captured standard error. */
  readonly stderr: string;
  /** Process exit code, if available. */
  readonly exitCode: number | null;
  /** Wall-clock execution duration in milliseconds. */
  readonly durationMs: number;
}

/**
 * Metadata for a collaborative editing room.
 */
export interface CollaborationRoom {
  /** Unique room identifier. */
  readonly roomId: string;
  /** Human-readable room label. */
  readonly name: string;
  /** Currently connected participant IDs. */
  readonly participants: readonly string[];
  /** ISO-8601 creation timestamp. */
  readonly createdAt: string;
}

/**
 * Represents a participant in a collaboration session.
 */
export interface Participant {
  /** Unique participant identifier. */
  readonly id: string;
  /** Display name. */
  readonly displayName: string;
  /** Whether this participant is an AI agent. */
  readonly isAI: boolean;
  /** Hex color assigned for cursor/selection rendering. */
  readonly cursorColor: string;
}

export interface SyncClientToServerEvents {
  readonly "join-room": (payload: {
    readonly roomId: string;
    readonly participant: Participant;
  }) => void;
  readonly "sync-step-1": (stateVector: Uint8Array) => void;
  readonly "sync-step-2": (diff: Uint8Array) => void;
  readonly "sync-update": (update: Uint8Array) => void;
  readonly "awareness-update": (update: Uint8Array) => void;
  readonly "execute-code": (payload: {
    readonly code: string;
    readonly language: SupportedLanguage;
  }) => void;
}

export interface SyncServerToClientEvents {
  readonly "sync-step-1": (stateVector: Uint8Array) => void;
  readonly "sync-step-2": (diff: Uint8Array) => void;
  readonly "sync-update": (update: Uint8Array) => void;
  readonly "awareness-update": (update: Uint8Array) => void;
  readonly "room-joined": (payload: {
    readonly roomId: string;
    readonly participants: readonly Participant[];
  }) => void;
  readonly "execution-result": (result: ExecutionResult) => void;
}

export interface SyncConnectionConfig {
  readonly serverUrl: string;
  readonly roomId: string;
  readonly participant: Participant;
}

export type SandboxRuntime = "runc" | "runsc";

export interface SandboxConfig {
  readonly runtime: SandboxRuntime;
  readonly memoryLimitMb: number;
  readonly cpuQuota: number;
  readonly networkDisabled: boolean;
}

/**
 * Metadata associated with a project workspace.
 */
export interface WorkspaceMetadata {
  /** Unique workspace identifier. */
  readonly id: string;
  /** Human-readable workspace name. */
  readonly name: string;
  /** Optional workspace description. */
  readonly description?: string;
  /** ISO-8601 creation timestamp. */
  readonly createdAt: string;
  /** ISO-8601 last update timestamp. */
  readonly updatedAt: string;
}

/**
 * Represents a file stored within a workspace.
 */
export interface WorkspaceFile {
  /** Unique file identifier. */
  readonly id: string;
  /** Name of the file with extension (e.g. "index.ts"). */
  readonly name: string;
  /** Parent folder ID, or null if located in the workspace root. */
  readonly parentId: string | null;
  /** Language runtime or syntax mode if known. */
  readonly language?: SupportedLanguage | string;
  /** Approximate byte size of the file. */
  readonly size?: number;
  /** ISO-8601 creation timestamp. */
  readonly createdAt: string;
  /** ISO-8601 last update timestamp. */
  readonly updatedAt: string;
}

/**
 * Represents a folder stored within a workspace.
 */
export interface WorkspaceFolder {
  /** Unique folder identifier. */
  readonly id: string;
  /** Directory name (e.g. "src"). */
  readonly name: string;
  /** Parent folder ID, or null if located in the workspace root. */
  readonly parentId: string | null;
  /** ISO-8601 creation timestamp. */
  readonly createdAt: string;
  /** ISO-8601 last update timestamp. */
  readonly updatedAt: string;
}

/**
 * Options used to initialize a new Workspace instance.
 */
export interface CreateWorkspaceOptions {
  /** Unique workspace identifier. */
  readonly id: string;
  /** Human-readable workspace name. */
  readonly name: string;
  /** Optional workspace description. */
  readonly description?: string;
  /** ISO-8601 creation timestamp. If omitted, current time is used. */
  readonly createdAt?: string;
  /** ISO-8601 update timestamp. If omitted, current time is used. */
  readonly updatedAt?: string;
}

export interface CreateFileOptions {
  readonly parentId?: string | null;
  readonly language?: SupportedLanguage | string;
  readonly initialContent?: string;
}

export interface FileOperationResult {
  readonly success: boolean;
  readonly file?: WorkspaceFile;
  readonly error?: string;
}

export interface CreateFolderOptions {
  readonly parentId?: string | null;
}

export interface FolderOperationResult {
  readonly success: boolean;
  readonly folder?: WorkspaceFolder;
  readonly error?: string;
}
