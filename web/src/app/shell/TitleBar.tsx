import { useEffect, type ReactNode } from "react";

import { useTitleBarTheme } from "@/features/preferences";
import { getPlatform } from "@/platform/platform";

export function TitleBar({ children }: { children: ReactNode }) {
    const layout = getPlatform().layout;
    const windowCaps = getPlatform().window;
    useTitleBarTheme();

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

    return (
        <>
            {layout.hasCustomTitlebar && (
                <div
                    className="app-titlebar bg-background"
                    onDoubleClick={() => {
                        windowCaps.toggleMaximize();
                    }}
                />
            )}
            {children}
        </>
    );
}
