import { cn } from "@lemma/ui";
import { useTheme } from "next-themes";
import { useEffect, useSyncExternalStore } from "react";
import type { RouterState } from "react-router";

import { getPlatform } from "@/platform/platform";

import { mergeRouteHandles } from "./route-handle";
import { router } from "./router";

/** The desktop title bar overlay, painted to match the `titleBar` surface the current route declares; the page background until the first route loads. */
export function TitleBar() {
    const { titlebarHeight, window: windowCaps } = getPlatform();
    const { resolvedTheme } = useTheme();
    const surface = useSyncExternalStore(subscribeToRouter, () =>
        titleBarSurface(router.state),
    );

    useEffect(() => {
        windowCaps.setTitleBar({
            theme: resolvedTheme === "dark" ? "dark" : "light",
            surface,
        });
    }, [windowCaps, resolvedTheme, surface]);

    return titlebarHeight > 0 ? (
        <div
            className={cn(
                "app-titlebar",
                surface === "sidebar" ? "bg-sidebar" : "bg-background",
            )}
            onDoubleClick={() => {
                windowCaps.toggleMaximize();
            }}
        />
    ) : null;
}

function subscribeToRouter(onChange: () => void) {
    return router.subscribe(onChange);
}

function titleBarSurface(state: RouterState) {
    const handles = state.initialized
        ? state.matches.map((match): unknown => match.route.handle)
        : [];
    return mergeRouteHandles(handles).titleBar ?? "background";
}
