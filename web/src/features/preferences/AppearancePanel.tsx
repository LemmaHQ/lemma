import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemSeparator,
    ItemTitle,
} from "@/components/ui/item";
import { isThemePreference } from "@/features/preferences/theme";

export function AppearancePanel() {
    const { i18n, t } = useTranslation();
    const { theme, setTheme } = useTheme();

    return (
        <div className="max-w-3xl px-8 py-6">
            <h2 className="text-base font-semibold">
                {t("settings.appearance")}
            </h2>
            <ItemGroup className="mt-2">
                <Item>
                    <ItemContent>
                        <ItemTitle>{t("settings.themeLabel")}</ItemTitle>
                        <ItemDescription>
                            {t("settings.themeDesc")}
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
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
                            <ToggleGroupItem
                                value="light"
                                aria-label={t("theme.light")}
                            >
                                <IconSun />
                                {t("theme.light")}
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="dark"
                                aria-label={t("theme.dark")}
                            >
                                <IconMoon />
                                {t("theme.dark")}
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="system"
                                aria-label={t("theme.system")}
                            >
                                <IconDeviceDesktop />
                                {t("theme.system")}
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </ItemActions>
                </Item>
                <ItemSeparator />
                <Item>
                    <ItemContent>
                        <ItemTitle>{t("settings.languageLabel")}</ItemTitle>
                        <ItemDescription>
                            {t("settings.languageDesc")}
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <ToggleGroup
                            variant="outline"
                            value={[
                                i18n.language.startsWith("zh") ? "zh" : "en",
                            ]}
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
                    </ItemActions>
                </Item>
            </ItemGroup>
        </div>
    );
}
