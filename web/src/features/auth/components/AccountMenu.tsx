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

import { useAuth } from "../store";

/** The signed-in account at the bottom of the sidebar, opening the settings at `settingsPath` and sign-out. */
export function AccountMenu({ settingsPath }: { settingsPath: string }) {
    const { t } = useTranslation();
    const { setOpenMobile } = useSidebar();
    const username = useAuth((s) => s.user?.username ?? "");
    const signOut = useAuth((s) => s.signOut);

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
                                render={<Link to={settingsPath} />}
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
                                    void signOut();
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
