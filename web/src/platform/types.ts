export interface WindowCapabilities {
    setTitleBar(state: {
        theme: "light" | "dark";
        surface: "sidebar" | "background";
    }): void;
    toggleMaximize(): void;
}

export interface SkipCredentials {
    serverUrl: string;
    username: string;
    password: string;
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
