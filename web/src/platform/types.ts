import type { TitleBarState } from "@lemma/desktop-bridge";

export interface WindowCapabilities {
    setTitleBar(state: TitleBarState): void;
    toggleMaximize(): void;
}

export interface AuthCapabilities {
    readonly cookieMode: boolean;
}

export interface PlatformAdapter {
    readonly baseUrl: string;
    readonly fetch: typeof globalThis.fetch;
    readonly window: WindowCapabilities;
    readonly auth: AuthCapabilities;
    readonly titlebarHeight: number;
    /** Version of the native client app; `null` in the browser. */
    readonly clientVersion: string | null;
}
