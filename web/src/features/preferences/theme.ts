import { useTheme } from "next-themes";
import { useEffect } from "react";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "lemma.theme";

export function isThemePreference(value: unknown): value is ThemePreference {
    return value === "light" || value === "dark" || value === "system";
}

export type TitleBarSurface = "sidebar" | "background";

let currentSurface: TitleBarSurface = "background";
let currentTheme: "light" | "dark" = "light";

function notifyTitleBar() {
    window.lemmaDesktop?.setTitleBar({
        theme: currentTheme,
        surface: currentSurface,
    });
}

export function setTitleBarSurface(surface: TitleBarSurface) {
    currentSurface = surface;
    document.documentElement.dataset.surface = surface;
    notifyTitleBar();
}

export function useTitleBarTheme() {
    const { resolvedTheme } = useTheme();
    useEffect(() => {
        if (resolvedTheme === "light" || resolvedTheme === "dark") {
            currentTheme = resolvedTheme;
            notifyTitleBar();
        }
    }, [resolvedTheme]);
}
