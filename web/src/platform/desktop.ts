import type {
    DesktopBridge,
    TitleBarState,
} from "../../../desktop/src/desktop-bridge";
import {
    connectEngine,
    createEngineFetch,
    ENGINE_BASE_URL,
} from "./engine-fetch";
import type { DirectoryPicker, PlatformAdapter } from "./types";

declare global {
    interface Window {
        lemmaDesktop?: DesktopBridge;
    }
}

export class DesktopAdapter implements PlatformAdapter {
    readonly baseUrl = ENGINE_BASE_URL;
    readonly fetch: typeof globalThis.fetch;
    readonly window: PlatformAdapter["window"];
    readonly directoryPicker: DirectoryPicker;
    readonly titlebarHeight: number;

    constructor(target: Window, bridge: DesktopBridge) {
        this.titlebarHeight = bridge.titlebarHeight;
        this.fetch = createEngineFetch(connectEngine(target, bridge));
        this.window = {
            setTitleBar: (state: TitleBarState): void => {
                bridge.setTitleBar(state);
            },
            toggleMaximize: (): void => {
                bridge.toggleMaximize();
            },
        };
        this.directoryPicker = {
            pick: () => bridge.pickDirectory(),
        };
    }
}
