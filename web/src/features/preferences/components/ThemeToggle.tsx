import {
    AnimateIcon,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
    MoonIcon,
    SunIcon,
    SunMoonIcon,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { isThemePreference, type ThemePreference } from "../theme";

const THEME_ICONS = {
    system: SunMoonIcon,
    light: SunIcon,
    dark: MoonIcon,
} satisfies Record<ThemePreference, unknown>;

const THEME_PREFERENCES: readonly ThemePreference[] = [
    "light",
    "dark",
    "system",
];

/** Icon button opening the theme menu; the icon shows the chosen theme. */
export function ThemeToggle() {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const current = isThemePreference(theme) ? theme : "system";
    const Icon = THEME_ICONS[current];

    return (
        <DropdownMenu>
            <Tooltip>
                <AnimateIcon animateOnHover asChild>
                    <TooltipTrigger
                        render={
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t("theme.toggle")}
                                    />
                                }
                            />
                        }
                    >
                        <Icon />
                    </TooltipTrigger>
                </AnimateIcon>
                <TooltipContent>{t("theme.toggle")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={current}>
                    {THEME_PREFERENCES.map((preference) => {
                        const PreferenceIcon = THEME_ICONS[preference];
                        return (
                            <AnimateIcon
                                key={preference}
                                animateOnHover
                                asChild
                            >
                                <DropdownMenuRadioItem
                                    value={preference}
                                    onClick={() => {
                                        setTheme(preference);
                                    }}
                                >
                                    <PreferenceIcon />
                                    {t(`theme.${preference}`)}
                                </DropdownMenuRadioItem>
                            </AnimateIcon>
                        );
                    })}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
