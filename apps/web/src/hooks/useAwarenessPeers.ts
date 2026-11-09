import { useState, useEffect } from "react";
import type { Awareness } from "y-protocols/awareness";
import {
  getRemotePeers,
  onPeersChanged,
  type PeerState,
} from "@tessera/collaboration";

export function useAwarenessPeers(
  awareness: Awareness | null,
): readonly PeerState[] {
  const [peers, setPeers] = useState<readonly PeerState[]>(() => {
    if (!awareness) {
      return [];
    }
    return getRemotePeers(awareness);
  });

  const [prevAwareness, setPrevAwareness] = useState(awareness);
  if (awareness !== prevAwareness) {
    setPrevAwareness(awareness);
    setPeers(awareness ? getRemotePeers(awareness) : []);
  }

  useEffect(() => {
    if (!awareness) {
      return;
    }

    const unsubscribe = onPeersChanged(awareness, (newPeers) => {
      setPeers(newPeers);
    });

    return () => {
      unsubscribe();
    };
  }, [awareness]);

  return peers;
}
