import { BotIcon, PaletteIcon } from "@lemma/ui";
import type { ParseKeys } from "i18next";
import type { ComponentType } from "react";

import { AppearancePanel } from "@/features/preferences";

import type { SettingsSegment } from "../route-paths";

/** One settings page in the routes and the navigation: its path segment, its navigation icon and title, and the page component it loads. */
export interface SettingsPageRoute {
    segment: SettingsSegment;
    icon: ComponentType;
    titleKey: ParseKeys;
    loadPage: () => Promise<ComponentType>;
}

/** A labeled group of settings pages in the navigation. */
export interface SettingsGroup {
    labelKey: ParseKeys;
    pages: readonly SettingsPageRoute[];
}

/** Every settings page in navigation order; it drives the settings routes and the navigation. */
export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
    {
        labelKey: "settings.groupGeneral",
        pages: [
            {
                segment: "appearance",
                icon: PaletteIcon,
                titleKey: "settings.appearance",
                loadPage: () => Promise.resolve(AppearancePanel),
            },
        ],
    },
    {
        labelKey: "settings.groupAgent",
        pages: [
            {
                segment: "providers",
                icon: BotIcon,
                titleKey: "settings.aiProviders",
                loadPage: async () =>
                    (await import("@/features/provider")).ProviderPanel,
            },
        ],
    },
];

/** Every settings page in navigation order, without the groups. */
export const SETTINGS_PAGES: readonly SettingsPageRoute[] =
    SETTINGS_GROUPS.flatMap((group) => group.pages);
