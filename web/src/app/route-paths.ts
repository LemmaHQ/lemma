/** The final path segment of each settings page. */
export type SettingsSegment = "appearance" | "providers" | "web";

/** URL paths of the app's routes. */
export const paths = {
    home: "/",
    settings: "/settings",
    session: (id: string) => `/sessions/${id}`,
    settingsPage: (segment: SettingsSegment) => `/settings/${segment}`,
};

/** Path of the active session `id`, or home when `id` is `null`. */
export function sessionPath(id: string | null): string {
    return id === null ? paths.home : paths.session(id);
}

let lastSessionPath = paths.home;

/** Remembers the current session path so settings can return to it. */
export function rememberSessionPath(path: string): void {
    lastSessionPath = path;
}

/** The most recent session route, defaulting to home. */
export function getLastSessionPath(): string {
    return lastSessionPath;
}
