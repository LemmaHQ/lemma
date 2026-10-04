declare global {
    interface Window {
        __LEMMA_SERVER_URL__?: string;
        lemmaDesktop?: {
            getServerUrl(): Promise<string | undefined>;
            setServerUrl(url: string): Promise<void>;
            toggleMaximize(): void;
        };
    }
}

export function isDesktop(): boolean {
    return typeof window !== "undefined" && window.lemmaDesktop !== undefined;
}

export function cookieAuth(): boolean {
    if (typeof window === "undefined" || isDesktop()) return false;
    const base = resolveBaseUrl();
    try {
        return (
            new URL(base, window.location.href).origin ===
            window.location.origin
        );
    } catch {
        return false;
    }
}

export function resolveBaseUrl(): string {
    const injected =
        typeof window !== "undefined" ? window.__LEMMA_SERVER_URL__ : undefined;
    const stored =
        typeof localStorage !== "undefined"
            ? localStorage.getItem("lemma.serverUrl")
            : null;
    return injected || stored || "/";
}

export function appPath(path: string): string {
    return window.location.protocol === "file:" ? `#${path}` : path;
}
