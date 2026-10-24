import type { DesktopBridge, TitleBarState } from "@lemma/desktop-bridge";

import type { PlatformAdapter } from "./types";

declare global {
    interface Window {
        __LEMMA_SERVER_URL__?: string;
        lemmaDesktop?: DesktopBridge;
    }
}

export class DesktopAdapter implements PlatformAdapter {
    readonly isDesktop = true;
    readonly baseUrl: string;

    readonly window = {
        setTitleBar: (state: TitleBarState): void => {
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
            typeof window === "undefined"
                ? undefined
                : // oxlint-disable-next-line eslint/no-underscore-dangle -- injected global name is owned by the desktop host
                  window.__LEMMA_SERVER_URL__;
        const stored =
            typeof localStorage === "undefined"
                ? null
                : localStorage.getItem("lemma.serverUrl");
        this.baseUrl =
            injected !== undefined && injected !== ""
                ? injected
                : stored !== null && stored !== ""
                  ? stored
                  : "/";
    }

    appPath(path: string): string {
        return `#${path}`;
    }
}
