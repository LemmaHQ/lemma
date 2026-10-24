import type { TitleBarState } from "@lemma/desktop-bridge";

export interface WindowCapabilities {
    setTitleBar(state: TitleBarState): void;
    toggleMaximize(): void;
}

export interface AuthCapabilities {
    readonly cookieMode: boolean;
}

export interface LayoutCapabilities {
    readonly hasCustomTitlebar: boolean;
    readonly titlebarHeight: number;
}

export interface PlatformAdapter {
    readonly isDesktop: boolean;
    readonly baseUrl: string;
    readonly fetch: typeof globalThis.fetch;
    readonly window: WindowCapabilities;
    readonly auth: AuthCapabilities;
    readonly layout: LayoutCapabilities;
}
