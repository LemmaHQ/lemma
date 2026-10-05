import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "lemma.theme";

export function readThemePreference(): ThemePreference {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
}

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
    if (pref === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    }
    return pref;
}

/** The page surface under the reserved titlebar strip: sidebar-shell
 *  pages vs full-bleed pages. The desktop shell mirrors it natively. */
export type TitleBarSurface = "sidebar" | "background";

let currentSurface: TitleBarSurface = "background";

/** Declares which surface the current page paints under the titlebar
 *  strip, marks the root dataset, and pushes to the desktop shell. */
export function setTitleBarSurface(surface: TitleBarSurface) {
    currentSurface = surface;
    document.documentElement.dataset.surface = surface;
    notifyTitleBar();
}

function notifyTitleBar() {
    window.lemmaDesktop?.setTitleBar({
        theme: resolveTheme(readThemePreference()),
        surface: currentSurface,
    });
}

/** Applies the resolved theme via the data-theme attribute on <html>. */
export function applyTheme(pref: ThemePreference) {
    const resolved = resolveTheme(pref);
    document.documentElement.setAttribute("data-theme", resolved);
    notifyTitleBar();
}

export function saveThemePreference(pref: ThemePreference) {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
}

export function useThemePreference(): readonly [
    ThemePreference,
    (pref: ThemePreference) => void,
] {
    const [preference, setPreference] =
        useState<ThemePreference>(readThemePreference);

    useEffect(() => {
        applyTheme(preference);
        if (preference !== "system") return;
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => applyTheme("system");
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, [preference]);

    const select = useCallback((pref: ThemePreference) => {
        saveThemePreference(pref);
        setPreference(pref);
    }, []);

    return [preference, select] as const;
}
