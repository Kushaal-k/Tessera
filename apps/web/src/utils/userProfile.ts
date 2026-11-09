export const DISPLAY_NAME_STORAGE_KEY = "tessera:display-name";

export function getSavedDisplayName(): string | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const saved = window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
    const trimmed = (saved ?? "").trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export function saveDisplayName(name: string): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    const trimmed = name.trim();
    if (trimmed) {
      window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, trimmed);
    }
  } catch {
    // localStorage may be unavailable or throw in private/restricted environments
  }
}
