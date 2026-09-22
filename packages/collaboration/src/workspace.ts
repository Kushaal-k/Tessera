// ──────────────────────────────────────────────────────────────
// @tessera/collaboration — Core Workspace abstraction
// ──────────────────────────────────────────────────────────────

import * as Y from "yjs";
import type {
  WorkspaceMetadata,
  WorkspaceFile,
  WorkspaceFolder,
  CreateWorkspaceOptions,
} from "@tessera/shared-types";

/**
 * Key identifiers used within the Yjs document to store workspace state.
 */
export const WORKSPACE_KEYS = {
  METADATA: "workspace:metadata",
  FILES: "workspace:files",
  FOLDERS: "workspace:folders",
  FILE_TEXT_PREFIX: "file:",
} as const;

/**
 * The core workspace abstraction used by Tessera to manage project
 * files, folders, and workspace metadata.
 *
 * This abstraction is independent of the UI and transport layers,
 * operating purely over a Yjs document (CRDT).
 */
export class Workspace {
  /** The underlying Yjs document. */
  public readonly doc: Y.Doc;

  private readonly _metadata: Y.Map<unknown>;
  private readonly _files: Y.Map<WorkspaceFile>;
  private readonly _folders: Y.Map<WorkspaceFolder>;

  constructor(options: CreateWorkspaceOptions, doc?: Y.Doc) {
    this.doc = doc ?? new Y.Doc();
    this._metadata = this.doc.getMap(WORKSPACE_KEYS.METADATA);
    this._files = this.doc.getMap<WorkspaceFile>(WORKSPACE_KEYS.FILES);
    this._folders = this.doc.getMap<WorkspaceFolder>(WORKSPACE_KEYS.FOLDERS);

    // Initialize metadata if not already present in the doc
    if (!this._metadata.has("id")) {
      const now = new Date().toISOString();
      this.doc.transact(() => {
        this._metadata.set("id", options.id);
        this._metadata.set("name", options.name);
        if (options.description !== undefined) {
          this._metadata.set("description", options.description);
        }
        this._metadata.set("createdAt", options.createdAt ?? now);
        this._metadata.set("updatedAt", options.updatedAt ?? now);
      });
    }
  }

  // ────────────────────────────────────────────────────────────
  // Metadata Management
  // ────────────────────────────────────────────────────────────

  /**
   * Retrieves the current workspace metadata snapshot.
   */
  public getMetadata(): WorkspaceMetadata {
    return {
      id: (this._metadata.get("id") as string) ?? "",
      name: (this._metadata.get("name") as string) ?? "",
      description: this._metadata.get("description") as string | undefined,
      createdAt: (this._metadata.get("createdAt") as string) ?? "",
      updatedAt: (this._metadata.get("updatedAt") as string) ?? "",
    };
  }

  /**
   * Updates workspace metadata fields and sets the updatedAt timestamp.
   */
  public updateMetadata(
    patch: Partial<Omit<WorkspaceMetadata, "id" | "createdAt">>,
  ): void {
    const now = new Date().toISOString();
    this.doc.transact(() => {
      if (patch.name !== undefined) {
        this._metadata.set("name", patch.name);
      }
      if (patch.description !== undefined) {
        this._metadata.set("description", patch.description);
      }
      this._metadata.set("updatedAt", patch.updatedAt ?? now);
    });
  }

  /**
   * Subscribes to changes in workspace metadata.
   */
  public onMetadataChanged(
    callback: (metadata: WorkspaceMetadata) => void,
  ): () => void {
    const observer = () => callback(this.getMetadata());
    this._metadata.observe(observer);
    return () => this._metadata.unobserve(observer);
  }

  // ────────────────────────────────────────────────────────────
  // File Storage
  // ────────────────────────────────────────────────────────────

  /**
   * Stores or updates a file in the workspace.
   */
  public setFile(file: WorkspaceFile): void {
    this._files.set(file.id, file);
  }

  /**
   * Retrieves a file by its unique identifier.
   */
  public getFile(id: string): WorkspaceFile | undefined {
    return this._files.get(id);
  }

  /**
   * Checks whether a file exists in the workspace.
   */
  public hasFile(id: string): boolean {
    return this._files.has(id);
  }

  /**
   * Deletes a file from the workspace.
   * Returns true if the file existed and was removed.
   */
  public deleteFile(id: string): boolean {
    if (!this._files.has(id)) {
      return false;
    }
    this._files.delete(id);
    return true;
  }

  /**
   * Returns all files currently stored in the workspace.
   */
  public getFiles(): WorkspaceFile[] {
    const files: WorkspaceFile[] = [];
    this._files.forEach((file) => {
      files.push(file);
    });
    return files;
  }

  /**
   * Returns the shared Y.Text type associated with a given file ID.
   * This provides the collaborative text buffer for the file.
   */
  public getFileText(id: string): Y.Text {
    return this.doc.getText(`${WORKSPACE_KEYS.FILE_TEXT_PREFIX}${id}`);
  }

  /**
   * Subscribes to changes in workspace files.
   */
  public onFilesChanged(
    callback: (files: WorkspaceFile[]) => void,
  ): () => void {
    const observer = () => callback(this.getFiles());
    this._files.observe(observer);
    return () => this._files.unobserve(observer);
  }

  // ────────────────────────────────────────────────────────────
  // Folder Storage
  // ────────────────────────────────────────────────────────────

  /**
   * Stores or updates a folder in the workspace.
   */
  public setFolder(folder: WorkspaceFolder): void {
    this._folders.set(folder.id, folder);
  }

  /**
   * Retrieves a folder by its unique identifier.
   */
  public getFolder(id: string): WorkspaceFolder | undefined {
    return this._folders.get(id);
  }

  /**
   * Checks whether a folder exists in the workspace.
   */
  public hasFolder(id: string): boolean {
    return this._folders.has(id);
  }

  /**
   * Deletes a folder from the workspace.
   * Returns true if the folder existed and was removed.
   */
  public deleteFolder(id: string): boolean {
    if (!this._folders.has(id)) {
      return false;
    }
    this._folders.delete(id);
    return true;
  }

  /**
   * Returns all folders currently stored in the workspace.
   */
  public getFolders(): WorkspaceFolder[] {
    const folders: WorkspaceFolder[] = [];
    this._folders.forEach((folder) => {
      folders.push(folder);
    });
    return folders;
  }

  /**
   * Subscribes to changes in workspace folders.
   */
  public onFoldersChanged(
    callback: (folders: WorkspaceFolder[]) => void,
  ): () => void {
    const observer = () => callback(this.getFolders());
    this._folders.observe(observer);
    return () => this._folders.unobserve(observer);
  }

  // ────────────────────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────────────────────

  /**
   * Tears down the workspace and frees the underlying Yjs document.
   */
  public destroy(): void {
    this.doc.destroy();
  }
}

/**
 * Creates a new Workspace instance.
 *
 * @param options Initial options and metadata for the workspace.
 * @param doc Optional existing Yjs document to wrap.
 */
export function createWorkspace(
  options: CreateWorkspaceOptions,
  doc?: Y.Doc,
): Workspace {
  return new Workspace(options, doc);
}

