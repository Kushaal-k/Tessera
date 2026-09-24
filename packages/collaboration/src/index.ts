export { createCollaborationDoc } from "./doc.js";
export type { CollaborationDoc, CollaborationDocOptions } from "./doc.js";

export {
  createAwareness,
  setLocalParticipant,
  getRemotePeers,
  onPeersChanged,
} from "./awareness.js";
export type { PeerState, AwarenessChangeCallback } from "./awareness.js";

export { TesseraSocketProvider } from "./provider.js";
export type { TesseraProviderOptions } from "./provider.js";

export {
  Workspace,
  createWorkspace,
  WORKSPACE_KEYS,
  detectLanguage,
} from "./workspace.js";

