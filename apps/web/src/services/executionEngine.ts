export function getExecutionEngineUrl(serverUrl?: string): string {
  const url =
    serverUrl ??
    (import.meta.env["VITE_EXECUTION_ENGINE_URL"] as string | undefined) ??
    "http://localhost:4002";

  return url.replace(/\/+$/, "");
}
