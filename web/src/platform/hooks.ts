import { useContext } from "react";

import { PlatformContext } from "./context";
import type { LayoutCapabilities, WindowCapabilities } from "./types";

export function usePlatformWindow(): WindowCapabilities {
    return useContext(PlatformContext).window;
}

export function usePlatformLayout(): LayoutCapabilities {
    return useContext(PlatformContext).layout;
}
