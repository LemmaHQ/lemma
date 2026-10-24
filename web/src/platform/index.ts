export { BrowserAdapter } from "./browser";
export { DesktopAdapter } from "./desktop";
export { getPlatform } from "./instance";
export { PlatformProvider } from "./PlatformProvider";
export { usePlatform, usePlatformLayout, usePlatformWindow } from "./hooks";
export type {
    AuthCapabilities,
    LayoutCapabilities,
    PlatformAdapter,
    WindowCapabilities,
} from "./types";
