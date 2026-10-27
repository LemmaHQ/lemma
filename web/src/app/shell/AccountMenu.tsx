import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@lemma/ui/components/dropdown-menu";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@lemma/ui/components/sidebar";
import { useSidebar } from "@lemma/ui/hooks/use-sidebar";
import { IconChevronDown, IconLogout, IconSettings } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/features/auth/store";

/** The signed-in account at the bottom of the sidebar, opening settings and sign-out. */
export function AccountMenu() {
    const { t } = useTranslation();
    const { setOpenMobile } = useSidebar();
    const username = useAuth((s) => s.user?.username ?? "");
    const logout = useAuth((s) => s.logout);

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={<SidebarMenuButton size="lg" />}
                    >
                        <Avatar size="sm">
                            <AvatarFallback>
                                {username.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate">
                            {username}
                        </span>
                        <IconChevronDown />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        side="top"
                        className="w-56"
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>{username}</DropdownMenuLabel>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            render={<Link to="/settings" viewTransition />}
                            onClick={() => {
                                setOpenMobile(false);
                            }}
                        >
                            <IconSettings />
                            {t("sidebar.appSettings")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => {
                                void logout();
                            }}
                        >
                            <IconLogout />
                            {t("sidebar.signOut")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
