/** Theme and surface that the window's titlebar overlay follows. */
export interface TitleBarState {
    theme: "light" | "dark";
    surface: "sidebar" | "background";
}

/** The default local account and the engine URL that let the web client skip sign-in. */
export interface SkipCredentials {
    serverUrl: string;
    username: string;
    password: string;
}

/** The API the desktop preload exposes to the web client as `window.lemmaDesktop`. */
export interface DesktopBridge {
    getSkipCredentials(): Promise<SkipCredentials | null>;
    setTitleBar(state: TitleBarState): void;
    toggleMaximize(): void;
}
