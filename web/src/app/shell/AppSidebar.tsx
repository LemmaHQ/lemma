import {
    IconChevronDown,
    IconLogout,
    IconPlus,
    IconSettings,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth/store";
import { ConversationList } from "@/features/conversations/ConversationList";
import type { SessionSummary } from "@/features/conversations/grouping";
import { LanguageToggle } from "@/features/preferences/LanguageToggle";
import { ThemeToggle } from "@/features/preferences/ThemeToggle";
import { useSidebar } from "@/lib/hooks/use-sidebar";

import { SidebarToggle } from "./SidebarToggle";

interface AppSidebarProps {
    sessions: SessionSummary[];
    activeSessionId: string | null;
    onGoHome: () => void;
    onOpenSession: (id: string) => void;
    onRenameSession: (id: string, title: string) => void;
    onDeleteSession: (id: string) => void;
}

export function AppSidebar({
    sessions,
    activeSessionId,
    onGoHome,
    onOpenSession,
    onRenameSession,
    onDeleteSession,
}: AppSidebarProps) {
    const { t } = useTranslation();
    const { setOpenMobile } = useSidebar();
    const username = useAuth((s) => s.user?.username ?? "");
    const logout = useAuth((s) => s.logout);

    return (
        <Sidebar variant="inset">
            <SidebarHeader>
                <div className="flex items-center justify-between pl-2">
                    <p className="text-sm font-semibold">
                        {t("common.appName")}
                    </p>
                    <SidebarToggle />
                </div>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={() => {
                                setOpenMobile(false);
                                onGoHome();
                            }}
                        >
                            <IconPlus />
                            <span>{t("sidebar.newChat")}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <ConversationList
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    onOpenSession={(id) => {
                        setOpenMobile(false);
                        onOpenSession(id);
                    }}
                    onRenameSession={onRenameSession}
                    onDeleteSession={onDeleteSession}
                />
            </SidebarContent>

            <SidebarFooter>
                <div className="flex items-center gap-1">
                    <SidebarMenu className="min-w-0 flex-1">
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
                                        <DropdownMenuLabel>
                                            {username}
                                        </DropdownMenuLabel>
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        render={<Link to="/settings" />}
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
                    <LanguageToggle />
                    <ThemeToggle />
                </div>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
