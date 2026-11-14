import type { ParseKeys } from "i18next";
import type { ComponentType } from "react";

import { AppearancePanel } from "@/features/preferences";

import type { SettingsSegment } from "../route-paths";

/** One settings page in the routes and the navigation: its path segment, its navigation title, and the page component it loads. */
export interface SettingsPageRoute {
    segment: SettingsSegment;
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
                titleKey: "settings.aiProviders",
                loadPage: async () =>
                    (await import("@/features/provider")).ProviderPanel,
            },
            {
                segment: "web",
                titleKey: "settings.web",
                loadPage: async () =>
                    (await import("@/features/web-provider")).WebProviderPanel,
            },
        ],
    },
];

/** Every settings page in navigation order, without the groups. */
export const SETTINGS_PAGES: readonly SettingsPageRoute[] =
    SETTINGS_GROUPS.flatMap((group) => group.pages);
