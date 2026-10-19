import { useEffect, useState } from "react";
import type { WorkspacePreviewStatus } from "@tessera/shared-types";
import { getPreviewStatus } from "../services/executionEngine.js";

export type PreviewState =
  | WorkspacePreviewStatus["status"]
  | "checking"
  | "unavailable";

export function usePreviewStatus(
  workspaceId: string,
  port: number,
  active: boolean,
  serverUrl?: string,
) {
  const [result, setResult] = useState<{
    workspaceId: string;
    port: number;
    serverUrl?: string;
    status: PreviewState;
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    let disposed = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    const checkStatus = async () => {
      controller = new AbortController();
      const timeout = setTimeout(() => {
        controller?.abort();
      }, 5000);

      try {
        const response = await getPreviewStatus(
          workspaceId,
          port,
          serverUrl,
          controller.signal,
        );
        if (!disposed) {
          setResult({ workspaceId, port, serverUrl, status: response.status });
        }
      } catch {
        if (!disposed) {
          setResult({ workspaceId, port, serverUrl, status: "unavailable" });
        }
      } finally {
        clearTimeout(timeout);
        if (!disposed) {
          pollTimer = setTimeout(() => {
            void checkStatus();
          }, 3000);
        }
      }
    };

    void checkStatus();

    return () => {
      disposed = true;
      if (pollTimer !== undefined) {
        clearTimeout(pollTimer);
      }
      controller?.abort();
    };
  }, [workspaceId, port, serverUrl, active, retryCount]);

  const matchesRequest =
    result?.workspaceId === workspaceId &&
    result.port === port &&
    result.serverUrl === serverUrl;

  return {
    status: matchesRequest ? result.status : "checking",
    retry: () => {
      setRetryCount((count) => count + 1);
    },
  };
}