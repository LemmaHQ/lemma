import { BotIcon, PaletteIcon } from "@lemma/ui";
import type { ParseKeys } from "i18next";
import type { ComponentType } from "react";

import type { SettingsSegment } from "../route-paths";

/** One settings page: its path segment, navigation icon, title, and the page component it loads. */
export interface SettingsSection {
    segment: SettingsSegment;
    icon: ComponentType;
    titleKey: ParseKeys;
    loadPage: () => Promise<ComponentType>;
}

/** A labeled group of settings sections in the navigation. */
export interface SettingsGroup {
    labelKey: ParseKeys;
    sections: readonly SettingsSection[];
}

/** Every settings section in navigation order; it drives the settings routes, the navigation, and the header title. */
export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
    {
        labelKey: "settings.groupGeneral",
        sections: [
            {
                segment: "appearance",
                icon: PaletteIcon,
                titleKey: "settings.appearance",
                loadPage: async () =>
                    (await import("./AppearanceSettingsPage"))
                        .AppearanceSettingsPage,
            },
        ],
    },
    {
        labelKey: "settings.groupAgent",
        sections: [
            {
                segment: "providers",
                icon: BotIcon,
                titleKey: "settings.aiProviders",
                loadPage: async () =>
                    (await import("@/features/providers")).ProvidersPanel,
            },
        ],
    },
];

/** Every settings section in navigation order, without the groups. */
export const SETTINGS_SECTIONS: readonly SettingsSection[] =
    SETTINGS_GROUPS.flatMap((group) => group.sections);
