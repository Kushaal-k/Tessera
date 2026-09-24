import * as Y from "yjs";
import type {
  WorkspaceMetadata,
  WorkspaceFile,
  WorkspaceFolder,
  CreateWorkspaceOptions,
} from "@tessera/shared-types";

export const WORKSPACE_KEYS = {
  METADATA: "workspace:metadata",
  FILES: "workspace:files",
  FOLDERS: "workspace:folders",
  FILE_TEXT_PREFIX: "file:",
} as const;

export class Workspace {
  public readonly doc: Y.Doc;
  private readonly _metadata: Y.Map<unknown>;
  private readonly _files: Y.Map<WorkspaceFile>;
  private readonly _folders: Y.Map<WorkspaceFolder>;

  constructor(options: CreateWorkspaceOptions, doc?: Y.Doc) {
    this.doc = doc ?? new Y.Doc();
    this._metadata = this.doc.getMap(WORKSPACE_KEYS.METADATA);
    this._files = this.doc.getMap<WorkspaceFile>(WORKSPACE_KEYS.FILES);
    this._folders = this.doc.getMap<WorkspaceFolder>(WORKSPACE_KEYS.FOLDERS);

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

  public getMetadata(): WorkspaceMetadata {
    return {
      id: (this._metadata.get("id") as string) ?? "",
      name: (this._metadata.get("name") as string) ?? "",
      description: this._metadata.get("description") as string | undefined,
      createdAt: (this._metadata.get("createdAt") as string) ?? "",
      updatedAt: (this._metadata.get("updatedAt") as string) ?? "",
    };
  }

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

  public onMetadataChanged(
    callback: (metadata: WorkspaceMetadata) => void,
  ): () => void {
    const observer = () => callback(this.getMetadata());
    this._metadata.observe(observer);
    return () => this._metadata.unobserve(observer);
  }

  public setFile(file: WorkspaceFile): void {
    this._files.set(file.id, file);
  }

  public getFile(id: string): WorkspaceFile | undefined {
    return this._files.get(id);
  }

  public hasFile(id: string): boolean {
    return this._files.has(id);
  }

  public deleteFile(id: string): boolean {
    if (!this._files.has(id)) {
      return false;
    }
    this._files.delete(id);
    return true;
  }

  public getFiles(): WorkspaceFile[] {
    const files: WorkspaceFile[] = [];
    this._files.forEach((file) => {
      files.push(file);
    });
    return files;
  }

  public getFileText(id: string): Y.Text {
    return this.doc.getText(`${WORKSPACE_KEYS.FILE_TEXT_PREFIX}${id}`);
  }

  public onFilesChanged(
    callback: (files: WorkspaceFile[]) => void,
  ): () => void {
    const observer = () => callback(this.getFiles());
    this._files.observe(observer);
    return () => this._files.unobserve(observer);
  }

  public setFolder(folder: WorkspaceFolder): void {
    this._folders.set(folder.id, folder);
  }

  public getFolder(id: string): WorkspaceFolder | undefined {
    return this._folders.get(id);
  }

  public hasFolder(id: string): boolean {
    return this._folders.has(id);
  }

  public deleteFolder(id: string): boolean {
    if (!this._folders.has(id)) {
      return false;
    }
    this._folders.delete(id);
    return true;
  }

  public getFolders(): WorkspaceFolder[] {
    const folders: WorkspaceFolder[] = [];
    this._folders.forEach((folder) => {
      folders.push(folder);
    });
    return folders;
  }

  public onFoldersChanged(
    callback: (folders: WorkspaceFolder[]) => void,
  ): () => void {
    const observer = () => callback(this.getFolders());
    this._folders.observe(observer);
    return () => this._folders.unobserve(observer);
  }

  public destroy(): void {
    this.doc.destroy();
  }
}

export function createWorkspace(
  options: CreateWorkspaceOptions,
  doc?: Y.Doc,
): Workspace {
  return new Workspace(options, doc);
}
