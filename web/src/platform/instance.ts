import { BrowserAdapter } from "./browser";
import { DesktopAdapter } from "./desktop";
import type { PlatformAdapter } from "./types";

let currentPlatform: PlatformAdapter | null = null;

export function getPlatform(): PlatformAdapter {
    if (currentPlatform === null) {
        const isElectron =
            typeof window !== "undefined" && window.lemmaDesktop !== undefined;
        currentPlatform = isElectron
            ? new DesktopAdapter()
            : new BrowserAdapter();
    }
    return currentPlatform;
}
