import type { PlatformAdapter } from "./types";

declare global {
    interface Window {
        __LEMMA_SERVER_URL__?: string;
        lemmaDesktop?: {
            getSkipCredentials(): Promise<{
                serverUrl: string;
                username: string;
                password: string;
            } | null>;
            setTitleBar(state: {
                theme: "light" | "dark";
                surface: "sidebar" | "background";
            }): void;
            toggleMaximize(): void;
        };
    }
}

export class DesktopAdapter implements PlatformAdapter {
    readonly isDesktop = true;
    readonly baseUrl: string;

    readonly window = {
        setTitleBar: (state: {
            theme: "light" | "dark";
            surface: "sidebar" | "background";
        }): void => {
            window.lemmaDesktop?.setTitleBar(state);
        },
        toggleMaximize: (): void => {
            window.lemmaDesktop?.toggleMaximize();
        },
    };

    readonly auth = {
        cookieMode: false,
        canSkipAuth: true,
        getSkipCredentials: () => {
            return (
                window.lemmaDesktop?.getSkipCredentials() ??
                Promise.resolve(null)
            );
        },
    };

    readonly layout = {
        hasCustomTitlebar: true,
        titlebarHeight: 40,
    };

    constructor() {
        const injected =
            typeof window !== "undefined"
                ? window.__LEMMA_SERVER_URL__
                : undefined;
        const stored =
            typeof localStorage !== "undefined"
                ? localStorage.getItem("lemma.serverUrl")
                : null;
        this.baseUrl = injected || stored || "/";
    }

    appPath(path: string): string {
        return `#${path}`;
    }
}
