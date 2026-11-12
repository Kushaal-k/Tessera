export function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "0ms";
  }

  const rounded = Math.round(durationMs);
  if (rounded < 1000) {
    return `${rounded}ms`;
  }

  if (rounded < 10_000) {
    const hundredths = Math.round(rounded / 10);
    const whole = Math.floor(hundredths / 100);
    const fraction = String(hundredths % 100).padStart(2, "0");
    return `${whole}.${fraction}s`;
  }
  if (rounded < 60_000) {
    const tenths = Math.round(rounded / 100);
    const whole = Math.floor(tenths / 10);
    const fraction = tenths % 10;
    return `${whole}.${fraction}s`;
  }

  const totalSeconds = Math.round(rounded / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}m ${remainder}s`;
}
