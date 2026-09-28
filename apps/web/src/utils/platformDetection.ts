interface NavigatorUAData {
  readonly platform: string;
}

/**
 * Detects if the current OS is macOS
 * Uses the modern userAgentData API if available, falls back to userAgent string
 */
export function isMacOS(): boolean {
  if ("userAgentData" in navigator && navigator.userAgentData) {
    return (navigator.userAgentData as NavigatorUAData).platform.toLowerCase() === "macos";
  }
  return navigator.userAgent.toLowerCase().includes("mac");
}

/**
 * Gets the platform-specific keyboard shortcut display text
 */
export function getExecutionShortcutText(): string {
  return isMacOS() ? "Cmd+Enter" : "Ctrl+Enter";
}
