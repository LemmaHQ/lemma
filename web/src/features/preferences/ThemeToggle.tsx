import { AnimateIcon } from "@animate-ui/react/icons";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@lemma/ui/components/dropdown-menu";
import { MoonIcon } from "@lemma/ui/icons/moon";
import { SunIcon } from "@lemma/ui/icons/sun";
import { SunMoonIcon } from "@lemma/ui/icons/sun-moon";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { isThemePreference, type ThemePreference } from "./theme";

const THEME_ICONS = {
    system: SunMoonIcon,
    light: SunIcon,
    dark: MoonIcon,
} satisfies Record<ThemePreference, unknown>;

const THEME_PREFERENCES: readonly ThemePreference[] = [
    "system",
    "light",
    "dark",
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
                <DropdownMenuRadioGroup
                    value={current}
                    onValueChange={(value: unknown) => {
                        if (isThemePreference(value)) setTheme(value);
                    }}
                >
                    {THEME_PREFERENCES.map((preference) => {
                        const PreferenceIcon = THEME_ICONS[preference];
                        return (
                            <AnimateIcon
                                key={preference}
                                animateOnHover
                                asChild
                            >
                                <DropdownMenuRadioItem value={preference}>
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
