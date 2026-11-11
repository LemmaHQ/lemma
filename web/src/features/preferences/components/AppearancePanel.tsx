import {
    AnimateIcon,
    MoonIcon,
    SettingsField,
    SettingsPage,
    SettingsSection,
    SunIcon,
    SunMoonIcon,
    ToggleGroup,
    ToggleGroupItem,
} from "@lemma/ui";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { isThemePreference } from "../theme";

/** The appearance settings page: the theme and the interface language. */
export function AppearancePanel() {
    const { i18n, t } = useTranslation();
    const { theme, setTheme } = useTheme();

    return (
        <SettingsPage title={t("settings.appearance")}>
            <SettingsSection>
                <SettingsField
                    label={t("settings.themeLabel")}
                    description={t("settings.themeDesc")}
                >
                    <ToggleGroup
                        variant="outline"
                        value={isThemePreference(theme) ? [theme] : []}
                        onValueChange={([value]) => {
                            if (isThemePreference(value)) {
                                setTheme(value);
                            }
                        }}
                        aria-label={t("settings.themeLabel")}
                    >
                        <AnimateIcon animateOnHover asChild>
                            <ToggleGroupItem
                                value="light"
                                aria-label={t("theme.light")}
                            >
                                <SunIcon />
                                {t("theme.light")}
                            </ToggleGroupItem>
                        </AnimateIcon>
                        <AnimateIcon animateOnHover asChild>
                            <ToggleGroupItem
                                value="dark"
                                aria-label={t("theme.dark")}
                            >
                                <MoonIcon />
                                {t("theme.dark")}
                            </ToggleGroupItem>
                        </AnimateIcon>
                        <AnimateIcon animateOnHover asChild>
                            <ToggleGroupItem
                                value="system"
                                aria-label={t("theme.system")}
                            >
                                <SunMoonIcon />
                                {t("theme.system")}
                            </ToggleGroupItem>
                        </AnimateIcon>
                    </ToggleGroup>
                </SettingsField>
                <SettingsField
                    label={t("settings.languageLabel")}
                    description={t("settings.languageDesc")}
                >
                    <ToggleGroup
                        variant="outline"
                        value={[i18n.language.startsWith("zh") ? "zh" : "en"]}
                        onValueChange={([value]) => {
                            if (value === "zh" || value === "en") {
                                void i18n.changeLanguage(value);
                            }
                        }}
                        aria-label={t("settings.languageLabel")}
                    >
                        <ToggleGroupItem value="zh" aria-label="中文">
                            中文
                        </ToggleGroupItem>
                        <ToggleGroupItem value="en" aria-label="English">
                            English
                        </ToggleGroupItem>
                    </ToggleGroup>
                </SettingsField>
            </SettingsSection>
        </SettingsPage>
    );
}
