import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SettingsField,
    SettingsPage,
    SettingsSection,
    ThemePreviewTiles,
} from "@lemma/ui";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { isThemePreference, type ThemePreference } from "../theme";

const LANGUAGES = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" },
] as const;

/** The appearance settings page: the theme and the interface language. */
export function AppearancePanel() {
    const { i18n, t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const transitionTimerRef = useRef<number | undefined>(undefined);
    const currentLang = i18n.language.startsWith("zh") ? "zh" : "en";

    useEffect(
        () => () => {
            window.clearTimeout(transitionTimerRef.current);
            document.documentElement.classList.remove("theme-transition");
        },
        [],
    );

    const handleThemeChange = (next: ThemePreference) => {
        window.clearTimeout(transitionTimerRef.current);
        document.documentElement.classList.add("theme-transition");
        setTheme(next);
        transitionTimerRef.current = window.setTimeout(() => {
            document.documentElement.classList.remove("theme-transition");
        }, 260);
    };

    return (
        <SettingsPage title={t("settings.appearance")}>
            <SettingsSection
                title={t("settings.appearance")}
                description={t("settings.appearanceDesc")}
            >
                <SettingsField
                    align="top"
                    label={t("settings.themeLabel")}
                    description={t("settings.themeDesc")}
                >
                    <ThemePreviewTiles
                        value={isThemePreference(theme) ? theme : "system"}
                        onValueChange={handleThemeChange}
                        label={t("settings.themeLabel")}
                        labels={{
                            light: t("theme.light"),
                            dark: t("theme.dark"),
                            system: t("theme.system"),
                        }}
                    />
                </SettingsField>
                <SettingsField
                    label={t("settings.languageLabel")}
                    description={t("settings.languageDesc")}
                >
                    <Select
                        items={LANGUAGES}
                        value={currentLang}
                        onValueChange={(value) => {
                            for (const option of LANGUAGES.filter(
                                (lang) => lang.value === value,
                            )) {
                                void i18n.changeLanguage(option.value);
                            }
                        }}
                    >
                        <SelectTrigger aria-label={t("settings.languageLabel")}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {LANGUAGES.map(({ value, label }) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingsField>
            </SettingsSection>
        </SettingsPage>
    );
}
