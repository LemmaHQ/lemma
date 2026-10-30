import {
    AnimateIcon,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@lemma/ui";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useMatch } from "react-router";

import { paths } from "../route-paths";
import { SETTINGS_GROUPS } from "./settings-sections";

/** Settings sections in the sidebar, grouped as `SETTINGS_GROUPS` lists them. */
export function SettingsNav() {
    const { t } = useTranslation();
    return SETTINGS_GROUPS.map((group) => (
        <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {group.sections.map((section) => (
                        <NavItem
                            key={section.segment}
                            icon={section.icon}
                            label={t(section.titleKey)}
                            to={paths.settingsSection(section.segment)}
                        />
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    ));
}

function NavItem({
    icon: Icon,
    label,
    to,
}: {
    icon: ComponentType;
    label: string;
    to: string;
}) {
    const { setOpenMobile } = useSidebar();
    const active = useMatch(to) !== null;
    return (
        <SidebarMenuItem>
            <AnimateIcon animateOnHover asChild>
                <SidebarMenuButton
                    isActive={active}
                    render={<NavLink to={to} />}
                    onClick={() => setOpenMobile(false)}
                >
                    <Icon />
                    <span>{label}</span>
                </SidebarMenuButton>
            </AnimateIcon>
        </SidebarMenuItem>
    );
}
