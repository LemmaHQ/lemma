import { useContext } from "react";

import { PlatformContext } from "./context";
import type {
    LayoutCapabilities,
    PlatformAdapter,
    WindowCapabilities,
} from "./types";

export function usePlatform(): PlatformAdapter {
    return useContext(PlatformContext);
}

export function usePlatformWindow(): WindowCapabilities {
    return useContext(PlatformContext).window;
}

export function usePlatformLayout(): LayoutCapabilities {
    return useContext(PlatformContext).layout;
}
