import {
    AnimateIcon,
    Avatar,
    AvatarFallback,
    ChevronDownIcon,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    LogOutIcon,
    SettingsIcon,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useAuth } from "@/features/auth";

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
                        <ChevronDownIcon />
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
                        <AnimateIcon animateOnHover asChild>
                            <DropdownMenuItem
                                render={<Link to="/settings" viewTransition />}
                                onClick={() => {
                                    setOpenMobile(false);
                                }}
                            >
                                <SettingsIcon />
                                {t("sidebar.appSettings")}
                            </DropdownMenuItem>
                        </AnimateIcon>
                        <AnimateIcon animateOnHover asChild>
                            <DropdownMenuItem
                                onClick={() => {
                                    void logout();
                                }}
                            >
                                <LogOutIcon />
                                {t("sidebar.signOut")}
                            </DropdownMenuItem>
                        </AnimateIcon>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
