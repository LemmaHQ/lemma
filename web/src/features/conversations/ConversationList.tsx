import { IconDots, IconPencil, IconTrash } from "@tabler/icons-react";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarInput,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { groupSessions, type SessionSummary } from "./grouping";

interface ConversationListProps {
    sessions: SessionSummary[];
    activeSessionId: string | null;
    onOpenSession: (id: string) => void;
    onRenameSession: (id: string, title: string) => void;
    onDeleteSession: (id: string) => void;
}

function SessionActions({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger
                    render={
                        <DropdownMenuTrigger
                            render={
                                <SidebarMenuAction
                                    showOnHover
                                    aria-label={t("sessions.actions")}
                                />
                            }
                        />
                    }
                >
                    <IconDots />
                </TooltipTrigger>
                <TooltipContent>{t("sessions.actions")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="start">
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function SessionItem({
    session,
    active,
    onOpen,
    onDelete,
    onRename,
}: {
    session: SessionSummary;
    active: boolean;
    onOpen: (id: string) => void;
    onDelete: (id: string) => void;
    onRename: (id: string, title: string) => void;
}) {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const focusRef = useCallback((el: HTMLInputElement | null) => {
        inputRef.current = el;
        el?.select();
    }, []);

    const commit = () => {
        const title = inputRef.current?.value.trim() ?? "";
        setEditing(false);
        if (title !== "" && title !== session.title) {
            onRename(session.id, title);
        }
    };

    if (editing) {
        return (
            <SidebarMenuItem>
                <SidebarInput
                    ref={focusRef}
                    defaultValue={session.title}
                    aria-label={t("sessions.rename")}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            commit();
                        } else if (e.key === "Escape") {
                            setEditing(false);
                        }
                    }}
                />
            </SidebarMenuItem>
        );
    }

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                isActive={active}
                onClick={() => onOpen(session.id)}
            >
                <span>
                    {session.title === ""
                        ? t("sidebar.newChat")
                        : session.title}
                </span>
            </SidebarMenuButton>
            <SessionActions>
                <DropdownMenuItem onClick={() => setEditing(true)}>
                    <IconPencil />
                    {t("sessions.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(session.id)}
                >
                    <IconTrash />
                    {t("sessions.delete")}
                </DropdownMenuItem>
            </SessionActions>
        </SidebarMenuItem>
    );
}

/** Conversation groups by recency. */
export function ConversationList({
    sessions,
    activeSessionId,
    onOpenSession,
    onRenameSession,
    onDeleteSession,
}: ConversationListProps) {
    const { t } = useTranslation();
    const groups = useMemo(() => groupSessions(sessions), [sessions]);

    return (
        <>
            {groups.map((group) => (
                <SidebarGroup key={group.key}>
                    <SidebarGroupLabel>
                        {t(`sessions.${group.key}`)}
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {group.items.map((session) => (
                                <SessionItem
                                    key={session.id}
                                    session={session}
                                    active={session.id === activeSessionId}
                                    onOpen={onOpenSession}
                                    onDelete={onDeleteSession}
                                    onRename={onRenameSession}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            ))}
        </>
    );
}
