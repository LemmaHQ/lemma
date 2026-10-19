import { IconArrowLeft, IconPalette, IconRobot } from "@tabler/icons-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useMatch } from "react-router";

import { Button } from "@/components/ui/button";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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

function NavGroup({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>{children}</SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

export function SettingsNav() {
    const { t } = useTranslation();
    return (
        <Sidebar variant="inset">
            <SidebarHeader>
                <div className="flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t("settings.backToHome")}
                                    render={<Link to="/" />}
                                    nativeButton={false}
                                />
                            }
                        >
                            <IconArrowLeft />
                        </TooltipTrigger>
                        <TooltipContent>
                            {t("settings.backToHome")}
                        </TooltipContent>
                    </Tooltip>
                    <h1 className="text-sm font-semibold">
                        {t("settings.title")}
                    </h1>
                </div>
            </SidebarHeader>
            <SidebarContent>
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
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    );
}
