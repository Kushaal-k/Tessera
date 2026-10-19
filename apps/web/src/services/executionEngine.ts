import type { WorkspacePreviewStatus } from "@tessera/shared-types";

export async function getPreviewStatus(
  workspaceId: string,
  port: number,
  serverUrl?: string,
  signal?: AbortSignal,
): Promise<WorkspacePreviewStatus> {
  const baseUrl = getExecutionEngineUrl(serverUrl);
  const response = await fetch(
    `${baseUrl}/preview/${encodeURIComponent(workspaceId)}/${port}/status`, 
    {
      signal,
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch preview status: ${response.status}`);
  }

  return (await response.json()) as WorkspacePreviewStatus;
}

export function getExecutionEngineUrl(serverUrl?: string): string {
  const url =
    serverUrl ??
    (import.meta.env["VITE_EXECUTION_ENGINE_URL"] as string | undefined) ??
    "http://localhost:4002";

  return url.replace(/\/+$/, "");
}
