import type { DesktopBridge, TitleBarState } from "@lemma/desktop-bridge";

import {
    connectEngine,
    createEngineFetch,
    ENGINE_BASE_URL,
} from "./engine-fetch";
import type { PlatformAdapter } from "./types";

declare global {
    interface Window {
        lemmaDesktop?: DesktopBridge;
    }
}

export class DesktopAdapter implements PlatformAdapter {
    readonly isDesktop = true;
    readonly baseUrl = ENGINE_BASE_URL;
    readonly fetch: typeof globalThis.fetch;
    readonly window: PlatformAdapter["window"];
    readonly auth: PlatformAdapter["auth"];

    readonly layout = {
        hasCustomTitlebar: true,
        titlebarHeight: 40,
    };

    constructor(target: Window, bridge: DesktopBridge) {
        this.fetch = createEngineFetch(connectEngine(target, bridge));
        this.window = {
            setTitleBar: (state: TitleBarState): void => {
                bridge.setTitleBar(state);
            },
            toggleMaximize: (): void => {
                bridge.toggleMaximize();
            },
        };
        this.auth = {
            cookieMode: false,
            canSkipAuth: true,
            getSkipCredentials: () => bridge.getSkipCredentials(),
        };
    }
}
