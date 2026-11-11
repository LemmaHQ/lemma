import type { TitleBarState } from "@lemma/desktop-contract";

export interface WindowCapabilities {
    setTitleBar(state: TitleBarState): void;
    toggleMaximize(): void;
}

export interface AuthCapabilities {
    readonly cookieMode: boolean;
}

export interface DirectoryPicker {
    pick(): Promise<string | null>;
}

export interface PlatformAdapter {
    readonly baseUrl: string;
    readonly fetch: typeof globalThis.fetch;
    readonly window: WindowCapabilities;
    readonly auth: AuthCapabilities;
    /** Native directory picker; `null` in the browser. */
    readonly directoryPicker: DirectoryPicker | null;
    readonly titlebarHeight: number;
    /** Version of the native client app; `null` in the browser. */
    readonly clientVersion: string | null;
}
