import { cn } from "@lemma/ui";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

import { getPlatform } from "@/platform/platform";

import { TitleBarContext, type TitleBarSurface } from "./title-bar-context";

/** The desktop title bar overlay; layouts below it choose its surface through `useTitleBarSurface`. */
export function TitleBar({ children }: { children: ReactNode }) {
    const { layout, window: windowCaps } = getPlatform();
    const { resolvedTheme } = useTheme();
    const [surface, setSurface] = useState<TitleBarSurface>("background");

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("custom-titlebar", layout.hasCustomTitlebar);
        root.style.setProperty(
            "--titlebar-height",
            `${layout.titlebarHeight}px`,
        );
        return () => {
            root.classList.remove("custom-titlebar");
            root.style.removeProperty("--titlebar-height");
        };
    }, [layout.hasCustomTitlebar, layout.titlebarHeight]);

    useEffect(() => {
        if (resolvedTheme === "light" || resolvedTheme === "dark") {
            windowCaps.setTitleBar({ theme: resolvedTheme, surface });
        }
    }, [windowCaps, resolvedTheme, surface]);

    return (
        <TitleBarContext value={setSurface}>
            {layout.hasCustomTitlebar && (
                <div
                    className={cn(
                        "app-titlebar",
                        surface === "sidebar" ? "bg-sidebar" : "bg-background",
                    )}
                    onDoubleClick={() => {
                        windowCaps.toggleMaximize();
                    }}
                />
            )}
            {children}
        </TitleBarContext>
    );
}
