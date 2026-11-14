import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";
import { NavLink, useMatch } from "react-router";

import { useProviders } from "@/features/provider";
import { isWebProviderActive, useWebProviders } from "@/features/web-provider";

import { paths, type SettingsSegment } from "../route-paths";
import { SETTINGS_GROUPS } from "./settings-pages";

/** Settings pages in the sidebar, grouped with enabled counts for providers and web backends. */
export function SettingsNav() {
    const { t } = useTranslation();
    const providers = useProviders();
    const webProviders = useWebProviders();

    const countFor = (segment: SettingsSegment): number | undefined => {
        switch (segment) {
            case "providers":
                return providers.loaded
                    ? providers.list.filter((provider) => provider.enabled)
                          .length
                    : undefined;
            case "web":
                return webProviders.loaded
                    ? webProviders.list.filter(isWebProviderActive).length
                    : undefined;
            case "appearance":
                return undefined;
        }
    };

    return SETTINGS_GROUPS.map((group) => (
        <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {group.pages.map((page) => (
                        <NavItem
                            key={page.segment}
                            label={t(page.titleKey)}
                            count={countFor(page.segment)}
                            to={paths.settingsPage(page.segment)}
                        />
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    ));
}

function NavItem({
    label,
    count,
    to,
}: {
    label: string;
    count: number | undefined;
    to: string;
}) {
    const { setOpenMobile } = useSidebar();
    const active = useMatch(to) !== null;
    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                isActive={active}
                className="justify-between"
                render={<NavLink to={to} />}
                onClick={() => setOpenMobile(false)}
            >
                <span className="truncate">{label}</span>
                {count !== undefined && (
                    <span className="text-caption text-subtle-foreground tabular-nums">
                        {count}
                    </span>
                )}
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
