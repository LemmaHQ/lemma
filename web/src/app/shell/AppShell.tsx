import { useEffect, type ReactNode } from "react";

import { usePlatform, usePlatformLayout, usePlatformWindow } from "@/platform";

export function AppShell({ children }: { children: ReactNode }) {
    const platform = usePlatform();
    const layout = usePlatformLayout();
    const windowCaps = usePlatformWindow();

    useEffect(() => {
        document.documentElement.classList.toggle(
            "desktop",
            platform.isDesktop,
        );
        return () => {
            document.documentElement.classList.remove("desktop");
        };
    }, [platform.isDesktop]);

    return (
        <>
            {layout.hasCustomTitlebar && (
                <div
                    className="desktop-titlebar bg-background"
                    onDoubleClick={() => {
                        windowCaps.toggleMaximize();
                    }}
                />
            )}
            {children}
        </>
    );
}
