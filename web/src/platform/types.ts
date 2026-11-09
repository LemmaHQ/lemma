export interface AuthCapabilities {
    readonly cookieMode: boolean;
}

export interface PlatformAdapter {
    readonly baseUrl: string;
    readonly fetch: typeof globalThis.fetch;
    readonly auth: AuthCapabilities;
}
