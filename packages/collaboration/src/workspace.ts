import * as Y from "yjs";
import type {
  WorkspaceMetadata,
  WorkspaceFile,
  WorkspaceFolder,
  CreateWorkspaceOptions,
  CreateFileOptions,
  FileOperationResult,
  CreateFolderOptions,
  FolderOperationResult,
} from "@tessera/shared-types";

export const WORKSPACE_KEYS = {
  METADATA: "workspace:metadata",
  FILES: "workspace:files",
  FOLDERS: "workspace:folders",
  FILE_TEXT_PREFIX: "file:",
} as const;

export function detectLanguage(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "py":
      return "python";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "java":
      return "java";
    case "cpp":
    case "cc":
    case "cxx":
    case "h":
    case "hpp":
      return "cpp";
    case "json":
      return "json";
    case "html":
      return "html";
    case "css":
      return "css";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}

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

  public createFile(
    name: string,
    options: CreateFileOptions = {},
  ): FileOperationResult {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: "File name cannot be empty" };
    }

    const parentId = options.parentId ?? null;
    if (parentId !== null && !this.hasFolder(parentId)) {
      return { success: false, error: "Parent folder does not exist" };
    }

    for (const file of this.getFiles()) {
      if (file.name === trimmedName && file.parentId === parentId) {
        return { success: false, error: "Duplicate file in folder" };
      }
    }

    const fileId = crypto.randomUUID();
    const now = new Date().toISOString();
    const language = options.language ?? detectLanguage(trimmedName);
    const initialContent = options.initialContent ?? "";

    const file: WorkspaceFile = {
      id: fileId,
      name: trimmedName,
      parentId,
      language,
      size: initialContent.length,
      createdAt: now,
      updatedAt: now,
    };

    this.doc.transact(() => {
      this._files.set(fileId, file);
      const ytext = this.getFileText(fileId);
      if (initialContent.length > 0) {
        ytext.insert(0, initialContent);
      }
    });

    return { success: true, file };
  }

  public deleteFile(id: string): boolean {
    if (!this._files.has(id)) {
      return false;
    }
    this.doc.transact(() => {
      this._files.delete(id);
      const ytext = this.getFileText(id);
      if (ytext.length > 0) {
        ytext.delete(0, ytext.length);
      }
    });
    return true;
  }

  public updateFileContent(id: string, content: string): boolean {
    const file = this.getFile(id);
    if (!file) {
      return false;
    }

    const ytext = this.getFileText(id);
    if (ytext.toString() === content) {
      return true;
    }

    const now = new Date().toISOString();
    this.doc.transact(() => {
      ytext.delete(0, ytext.length);
      if (content.length > 0) {
        ytext.insert(0, content);
      }
      this._files.set(id, {
        ...file,
        size: content.length,
        updatedAt: now,
      });
    });

    return true;
  }

  public getFileContent(id: string): string | undefined {
    if (!this.hasFile(id)) {
      return undefined;
    }
    return this.getFileText(id).toString();
  }

  public renameFile(id: string, newName: string): FileOperationResult {
    const file = this.getFile(id);
    if (!file) {
      return { success: false, error: "File not found" };
    }

    const trimmedName = newName.trim();
    if (!trimmedName) {
      return { success: false, error: "File name cannot be empty" };
    }

    if (file.name === trimmedName) {
      return { success: true, file };
    }

    for (const f of this.getFiles()) {
      if (f.id !== id && f.name === trimmedName && f.parentId === file.parentId) {
        return { success: false, error: "Duplicate file in folder" };
      }
    }

    const now = new Date().toISOString();
    const updatedFile: WorkspaceFile = {
      ...file,
      name: trimmedName,
      language: detectLanguage(trimmedName),
      updatedAt: now,
    };

    this.doc.transact(() => {
      this._files.set(id, updatedFile);
    });

    return { success: true, file: updatedFile };
  }

  public moveFile(
    id: string,
    targetParentId: string | null,
  ): FileOperationResult {
    const file = this.getFile(id);
    if (!file) {
      return { success: false, error: "File not found" };
    }

    if (file.parentId === targetParentId) {
      return { success: true, file };
    }

    if (targetParentId !== null && !this.hasFolder(targetParentId)) {
      return { success: false, error: "Target folder does not exist" };
    }

    for (const f of this.getFiles()) {
      if (f.id !== id && f.name === file.name && f.parentId === targetParentId) {
        return {
          success: false,
          error: "A file with the same name already exists in target folder",
        };
      }
    }

    const now = new Date().toISOString();
    const updatedFile: WorkspaceFile = {
      ...file,
      parentId: targetParentId,
      updatedAt: now,
    };

    this.doc.transact(() => {
      this._files.set(id, updatedFile);
    });

    return { success: true, file: updatedFile };
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

  public createFolder(
    name: string,
    options: CreateFolderOptions = {},
  ): FolderOperationResult {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: "Folder name cannot be empty" };
    }

    const parentId = options.parentId ?? null;
    if (parentId !== null && !this.hasFolder(parentId)) {
      return { success: false, error: "Parent folder does not exist" };
    }

    for (const folder of this.getFolders()) {
      if (folder.parentId === parentId && folder.name === trimmedName) {
        return { success: false, error: "Duplicate folder in parent directory" };
      }
    }

    const folderId = crypto.randomUUID();
    const now = new Date().toISOString();
    const folder: WorkspaceFolder = {
      id: folderId,
      name: trimmedName,
      parentId,
      createdAt: now,
      updatedAt: now,
    };

    this.doc.transact(() => {
      this._folders.set(folderId, folder);
    });

    return { success: true, folder };
  }

  public deleteFolder(id: string): boolean {
    if (!this._folders.has(id)) {
      return false;
    }

    const descendantIds = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      descendantIds.add(currentId);
      for (const folder of this.getFolders()) {
        if (folder.parentId === currentId && !descendantIds.has(folder.id)) {
          queue.push(folder.id);
        }
      }
    }

    this.doc.transact(() => {
      for (const file of this.getFiles()) {
        if (file.parentId && descendantIds.has(file.parentId)) {
          this._files.delete(file.id);
          const ytext = this.getFileText(file.id);
          if (ytext.length > 0) {
            ytext.delete(0, ytext.length);
          }
        }
      }

      for (const folderId of descendantIds) {
        this._folders.delete(folderId);
      }
    });

    return true;
  }

  public renameFolder(id: string, newName: string): FolderOperationResult {
    const folder = this.getFolder(id);
    if (!folder) {
      return { success: false, error: "Folder not found" };
    }

    const trimmedName = newName.trim();
    if (!trimmedName) {
      return { success: false, error: "Folder name cannot be empty" };
    }

    if (folder.name === trimmedName) {
      return { success: true, folder };
    }

    for (const f of this.getFolders()) {
      if (f.id !== id && f.parentId === folder.parentId && f.name === trimmedName) {
        return { success: false, error: "Duplicate folder in parent directory" };
      }
    }

    const now = new Date().toISOString();
    const updatedFolder: WorkspaceFolder = {
      ...folder,
      name: trimmedName,
      updatedAt: now,
    };

    this.doc.transact(() => {
      this._folders.set(id, updatedFolder);
    });

    return { success: true, folder: updatedFolder };
  }

  public moveFolder(
    id: string,
    targetParentId: string | null,
  ): FolderOperationResult {
    const folder = this.getFolder(id);
    if (!folder) {
      return { success: false, error: "Folder not found" };
    }

    if (folder.parentId === targetParentId) {
      return { success: true, folder };
    }

    if (targetParentId !== null) {
      if (targetParentId === id) {
        return { success: false, error: "Cannot move folder into itself" };
      }

      if (!this.hasFolder(targetParentId)) {
        return { success: false, error: "Target folder does not exist" };
      }

      if (this.isDescendant(targetParentId, id)) {
        return {
          success: false,
          error: "Cannot move folder into its own descendant",
        };
      }
    }

    for (const f of this.getFolders()) {
      if (f.id !== id && f.parentId === targetParentId && f.name === folder.name) {
        return {
          success: false,
          error: "A folder with the same name already exists in target folder",
        };
      }
    }

    const now = new Date().toISOString();
    const updatedFolder: WorkspaceFolder = {
      ...folder,
      parentId: targetParentId,
      updatedAt: now,
    };

    this.doc.transact(() => {
      this._folders.set(id, updatedFolder);
    });

    return { success: true, folder: updatedFolder };
  }

  public getFolderPath(id: string): string | undefined {
    const folder = this.getFolder(id);
    if (!folder) {
      return undefined;
    }

    const segments: string[] = [];
    let current: WorkspaceFolder | undefined = folder;
    const visited = new Set<string>();

    while (current) {
      if (visited.has(current.id)) {
        break;
      }
      visited.add(current.id);
      segments.unshift(current.name);
      current = current.parentId ? this.getFolder(current.parentId) : undefined;
    }

    return "/" + segments.join("/");
  }

  public getSubfolders(parentId: string | null = null): WorkspaceFolder[] {
    return this.getFolders().filter((folder) => folder.parentId === parentId);
  }

  public isDescendant(folderId: string, potentialAncestorId: string): boolean {
    let current = this.getFolder(folderId);
    const visited = new Set<string>();

    while (current && current.parentId !== null) {
      if (visited.has(current.id)) {
        break;
      }
      visited.add(current.id);
      if (current.parentId === potentialAncestorId) {
        return true;
      }
      current = this.getFolder(current.parentId);
    }

    return false;
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
