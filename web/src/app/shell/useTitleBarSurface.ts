import { use, useLayoutEffect } from "react";

import { TitleBarContext, type TitleBarSurface } from "./title-bar-context";

/** Paints the title bar to match `surface` from the time the calling layout mounts. */
export function useTitleBarSurface(surface: TitleBarSurface) {
    const setSurface = use(TitleBarContext);
    useLayoutEffect(() => {
        setSurface?.(surface);
    }, [setSurface, surface]);
}
