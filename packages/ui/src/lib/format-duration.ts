/** Formats elapsed time as 0.4s, 12.3s, or 2m 05s. */
export function formatDuration(ms: number, live = false): string {
    if (!live && ms < 1000) {
        return `${Math.max(1, Math.round(ms))}ms`;
    }
    if (ms < 60_000) {
        return `${(Math.floor(ms / 100) / 10).toFixed(1)}s`;
    }
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
