import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@lemma/ui/components/sidebar";
import { useSidebar } from "@lemma/ui/hooks/use-sidebar";
import { IconPalette, IconRobot } from "@tabler/icons-react";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useMatch } from "react-router";

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
            <SidebarMenuButton
                isActive={active}
                render={<NavLink to={to} />}
                onClick={() => setOpenMobile(false)}
            >
                <Icon />
                <span>{label}</span>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>{children}</SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

/** Settings sections in the sidebar. */
export function SettingsNav() {
    const { t } = useTranslation();
    return (
        <>
            <NavGroup label={t("settings.groupGeneral")}>
                <NavItem
                    icon={IconPalette}
                    label={t("settings.appearance")}
                    to="/settings/appearance"
                />
            </NavGroup>
            <NavGroup label={t("settings.groupAgent")}>
                <NavItem
                    icon={IconRobot}
                    label={t("settings.aiProviders")}
                    to="/settings/providers"
                />
            </NavGroup>
        </>
    );
}
