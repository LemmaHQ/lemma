import {
    AnimateIcon,
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
    MoonIcon,
    Separator,
    SunIcon,
    SunMoonIcon,
    ToggleGroup,
    ToggleGroupItem,
} from "@lemma/ui";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { isThemePreference } from "../theme";

export function AppearancePanel() {
    const { i18n, t } = useTranslation();
    const { theme, setTheme } = useTheme();

    return (
        <div className="max-w-3xl px-4 py-6 md:px-6">
            <ItemGroup>
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
                    </ItemActions>
                </Item>
                <Separator />
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
