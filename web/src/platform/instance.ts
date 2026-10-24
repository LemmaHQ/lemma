import { BrowserAdapter } from "./browser";
import { DesktopAdapter } from "./desktop";
import type { PlatformAdapter } from "./types";

let currentPlatform: PlatformAdapter | null = null;

export function getPlatform(): PlatformAdapter {
    if (currentPlatform === null) {
        const bridge =
            typeof window === "undefined" ? undefined : window.lemmaDesktop;
        currentPlatform =
            bridge === undefined
                ? new BrowserAdapter()
                : new DesktopAdapter(window, bridge);
    }
    return currentPlatform;
}
