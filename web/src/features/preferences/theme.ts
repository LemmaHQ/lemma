export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "lemma.theme";

export function isThemePreference(value: unknown): value is ThemePreference {
    return value === "light" || value === "dark" || value === "system";
}
