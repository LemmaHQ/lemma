import { BrowserAdapter } from "./browser";
import type { PlatformAdapter } from "./types";

let currentPlatform: PlatformAdapter | null = null;

export function getPlatform(): PlatformAdapter {
    currentPlatform ??= new BrowserAdapter();
    return currentPlatform;
}
