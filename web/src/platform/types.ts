import type { SkipCredentials, TitleBarState } from "@lemma/desktop-bridge";

export type { SkipCredentials };

export interface WindowCapabilities {
    setTitleBar(state: TitleBarState): void;
    toggleMaximize(): void;
}

export interface AuthCapabilities {
    readonly cookieMode: boolean;
    readonly canSkipAuth: boolean;
    getSkipCredentials(): Promise<SkipCredentials | null>;
}

export interface LayoutCapabilities {
    readonly hasCustomTitlebar: boolean;
    readonly titlebarHeight: number;
}

export interface PlatformAdapter {
    readonly isDesktop: boolean;
    readonly baseUrl: string;
    readonly window: WindowCapabilities;
    readonly auth: AuthCapabilities;
    readonly layout: LayoutCapabilities;
    appPath(path: string): string;
}
