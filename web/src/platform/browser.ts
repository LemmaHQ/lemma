import type { PlatformAdapter } from "./types";

function resolveBaseUrl(): string {
    const stored = localStorage.getItem("lemma.serverUrl");
    if (stored !== null && stored !== "") {
        return stored;
    }
    return "/";
}

function resolveCookieMode(baseUrl: string): boolean {
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
    readonly baseUrl: string;
    readonly fetch: typeof globalThis.fetch = (input, init) =>
        globalThis.fetch(input, init);

    readonly auth = {
        cookieMode: false,
    };

    constructor() {
        this.baseUrl = resolveBaseUrl();
        this.auth.cookieMode = resolveCookieMode(this.baseUrl);
    }
}
