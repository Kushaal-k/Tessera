import * as Y from "yjs";
import type { CollaborationRoom } from "@tessera/shared-types";

export interface CollaborationDocOptions {
  readonly room: CollaborationRoom;
}

export interface CollaborationDoc {
  readonly ydoc: Y.Doc;
  readonly ytext: Y.Text;
  readonly room: CollaborationRoom;
  destroy(): void;
}

export function createCollaborationDoc(
  options: CollaborationDocOptions,
): CollaborationDoc {
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText("monaco");

  return {
    ydoc,
    ytext,
    room: options.room,
    destroy() {
      ydoc.destroy();
    },
  };
}
