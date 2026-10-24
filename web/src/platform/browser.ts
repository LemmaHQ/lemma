import type { PlatformAdapter } from "./types";

function resolveBaseUrl(): string {
    if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("lemma.serverUrl");
        if (stored !== null && stored !== "") {
            return stored;
        }
    }
    return "/";
}

function resolveCookieMode(baseUrl: string): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        return (
            new URL(baseUrl, window.location.href).origin ===
            window.location.origin
        );
    } catch {
        return false;
    }
}

export class BrowserAdapter implements PlatformAdapter {
    readonly isDesktop = false;
    readonly baseUrl: string;
    readonly fetch: typeof globalThis.fetch = (input, init) =>
        globalThis.fetch(input, init);

    readonly window = {
        setTitleBar: (): void => {},
        toggleMaximize: (): void => {},
    };

    readonly auth = {
        cookieMode: false,
        canSkipAuth: false,
        getSkipCredentials: () => Promise.resolve(null),
    };

    readonly layout = {
        hasCustomTitlebar: false,
        titlebarHeight: 0,
    };

    constructor() {
        this.baseUrl = resolveBaseUrl();
        this.auth.cookieMode = resolveCookieMode(this.baseUrl);
    }

    appPath(path: string): string {
        return path;
    }
}
