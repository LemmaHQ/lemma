import {
    IconChevronDown,
    IconLayoutSidebar,
    IconLogout,
    IconPlus,
    IconSettings,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/store";
import { ConversationList } from "@/features/conversations/ConversationList";
import type { SessionSummary } from "@/features/conversations/grouping";
import { LanguageToggle } from "@/features/preferences/LanguageToggle";
import { ThemeToggle } from "@/features/preferences/ThemeToggle";

interface AppSidebarProps {
    sessions: SessionSummary[];
    archived: SessionSummary[];
    activeSessionId: string | null;
    onGoHome: () => void;
    onOpenSession: (id: string) => void;
    onArchiveSession: (id: string) => void;
    onRenameSession: (id: string, title: string) => void;
    onRestoreSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
    onCollapse: () => void;
}

export function AppSidebar({
    sessions,
    archived,
    activeSessionId,
    onGoHome,
    onOpenSession,
    onArchiveSession,
    onRenameSession,
    onRestoreSession,
    onDeleteSession,
    onCollapse,
}: AppSidebarProps) {
    const { t } = useTranslation();
    const username = useAuth((s) => s.user?.username ?? "");
    const logout = useAuth((s) => s.logout);

    return (
        <aside className="flex h-full w-65 shrink-0 flex-col bg-transparent text-sidebar-foreground">
            <div className="flex items-center justify-between px-3 pt-4">
                <p className="text-sm font-semibold">{t("common.appName")}</p>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground"
                    onClick={onCollapse}
                    aria-label={t("sidebar.collapse")}
                    title={t("sidebar.collapse")}
                >
                    <IconLayoutSidebar />
                </Button>
            </div>

            <div className="px-3 pt-3">
                <button
                    type="button"
                    onClick={onGoHome}
                    className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-sm transition-colors hover:bg-accent"
                >
                    <IconPlus className="size-4" />
                    {t("sidebar.newChat")}
                </button>
            </div>

            <ConversationList
                sessions={sessions}
                archived={archived}
                activeSessionId={activeSessionId}
                onOpenSession={onOpenSession}
                onArchiveSession={onArchiveSession}
                onRenameSession={onRenameSession}
                onRestoreSession={onRestoreSession}
                onDeleteSession={onDeleteSession}
            />

            <div className="flex items-center gap-2 border-t border-sidebar-border p-3">
                <DropdownMenu>
                    <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 transition-colors hover:bg-sidebar-accent">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs">
                            {username.charAt(0)}
                        </span>
                        <span className="flex-1 truncate text-left text-sm">
                            {username}
                        </span>
                        <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        side="top"
                        className="w-56"
                    >
                        <div className="p-2">
                            <p className="text-sm font-medium">{username}</p>
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem render={<Link to="/settings" />}>
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
                <LanguageToggle />
                <ThemeToggle />
            </div>
        </aside>
    );
}
