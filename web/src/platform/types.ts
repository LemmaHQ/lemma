import type { TitleBarState } from "../../../desktop/src/desktop-bridge";

export interface WindowCapabilities {
    setTitleBar(state: TitleBarState): void;
    toggleMaximize(): void;
}

export interface DirectoryPicker {
    pick(): Promise<string | null>;
}

export interface PlatformAdapter {
    readonly baseUrl: string;
    readonly fetch: typeof globalThis.fetch;
    readonly window: WindowCapabilities;
    /** Native directory picker; `null` in the browser. */
    readonly directoryPicker: DirectoryPicker | null;
    readonly titlebarHeight: number;
}
