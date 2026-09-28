import type { WorkspaceFolder } from "@tessera/shared-types";

/**
 * Collects all descendant folder IDs (including the given folderId itself)
 * using a breadth-first traversal of the folder hierarchy.
 */
export function collectDescendantFolderIds(
  folderId: string,
  folders: readonly WorkspaceFolder[],
): Set<string> {
  const descendantIds = new Set<string>();
  const queue = [folderId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    descendantIds.add(current);
    for (const folder of folders) {
      if (folder.parentId === current && !descendantIds.has(folder.id)) {
        queue.push(folder.id);
      }
    }
  }

  return descendantIds;
}
