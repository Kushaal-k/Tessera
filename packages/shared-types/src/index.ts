export type SupportedLanguage = "typescript" | "python" | "cpp" | "go" | "java" | "rust";

export type ExecutionStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "timeout";

export interface ExecutionTask {
  readonly id: string;
  readonly code: string;
  readonly language: SupportedLanguage;
  readonly timeoutMs: number;
  readonly roomId: string;
  readonly createdAt: string;
}

export interface ExecutionResult {
  readonly taskId: string;
  readonly status: ExecutionStatus;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly durationMs: number;
}

export interface CollaborationRoom {
  readonly roomId: string;
  readonly name: string;
  readonly participants: readonly string[];
  readonly createdAt: string;
}

export interface Participant {
  readonly id: string;
  readonly displayName: string;
  readonly isAI: boolean;
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

export interface WorkspaceMetadata {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkspaceFile {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly language?: SupportedLanguage | string;
  readonly size?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkspaceFolder {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateWorkspaceOptions {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly createdAt?: string;
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
