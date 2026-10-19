import {
    IconArchive,
    IconChevronRight,
    IconDots,
    IconPencil,
    IconRestore,
    IconTrash,
} from "@tabler/icons-react";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
    archived: SessionSummary[];
    activeSessionId: string | null;
    onOpenSession: (id: string) => void;
    onArchiveSession: (id: string) => void;
    onRenameSession: (id: string, title: string) => void;
    onRestoreSession: (id: string) => void;
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
    onArchive,
    onRename,
}: {
    session: SessionSummary;
    active: boolean;
    onOpen: (id: string) => void;
    onArchive: (id: string) => void;
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
                <DropdownMenuItem onClick={() => onArchive(session.id)}>
                    <IconArchive />
                    {t("sessions.archive")}
                </DropdownMenuItem>
            </SessionActions>
        </SidebarMenuItem>
    );
}

function ArchivedItem({
    session,
    onRestore,
    onDelete,
}: {
    session: SessionSummary;
    onRestore: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    const { t } = useTranslation();
    return (
        <SidebarMenuItem>
            <SidebarMenuButton render={<div />}>
                <span>
                    {session.title === ""
                        ? t("sidebar.newChat")
                        : session.title}
                </span>
            </SidebarMenuButton>
            <SessionActions>
                <DropdownMenuItem onClick={() => onRestore(session.id)}>
                    <IconRestore />
                    {t("sessions.restore")}
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

/** Conversation groups by recency, followed by the collapsed archive. */
export function ConversationList({
    sessions,
    archived,
    activeSessionId,
    onOpenSession,
    onArchiveSession,
    onRenameSession,
    onRestoreSession,
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
                                    onArchive={onArchiveSession}
                                    onRename={onRenameSession}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            ))}

            {archived.length > 0 && (
                <Collapsible render={<SidebarGroup />}>
                    <SidebarGroupLabel render={<CollapsibleTrigger />}>
                        {t("sessions.archived")} ({archived.length})
                        <IconChevronRight className="ml-auto transition-transform in-data-panel-open:rotate-90" />
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {archived.map((session) => (
                                    <ArchivedItem
                                        key={session.id}
                                        session={session}
                                        onRestore={onRestoreSession}
                                        onDelete={onDeleteSession}
                                    />
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </>
    );
}
