import { AnimateIcon } from "@animate-ui/react/icons";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
} from "@lemma/ui/components/dropdown-menu";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarInput,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@lemma/ui/components/sidebar";
import { useSidebar } from "@lemma/ui/hooks/use-sidebar";
import { EllipsisIcon } from "@lemma/ui/icons/ellipsis";
import { PencilIcon } from "@lemma/ui/icons/pencil";
import { Trash2Icon } from "@lemma/ui/icons/trash-2";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

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
                <AnimateIcon animateOnHover asChild>
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
                        <EllipsisIcon />
                    </TooltipTrigger>
                </AnimateIcon>
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
                        ? t("sidebar.newConversation")
                        : session.title}
                </span>
            </SidebarMenuButton>
            <SessionActions>
                <AnimateIcon animateOnHover asChild>
                    <DropdownMenuItem onClick={() => setEditing(true)}>
                        <PencilIcon />
                        {t("sessions.rename")}
                    </DropdownMenuItem>
                </AnimateIcon>
                <AnimateIcon animateOnHover asChild>
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDelete(session.id)}
                    >
                        <Trash2Icon />
                        {t("sessions.delete")}
                    </DropdownMenuItem>
                </AnimateIcon>
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
    const { setOpenMobile } = useSidebar();
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
                                    onOpen={(id) => {
                                        setOpenMobile(false);
                                        onOpenSession(id);
                                    }}
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
