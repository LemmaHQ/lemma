import {
    AnimateIcon,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    EllipsisIcon,
    PencilIcon,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarInput,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    Skeleton,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    Trash2Icon,
    useSidebar,
} from "@lemma/ui";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { groupSessions, type SessionSummary } from "../grouping";

interface SessionGroupsProps {
    sessions: SessionSummary[];
    loaded: boolean;
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
                                        aria-label={t("session.actions")}
                                    />
                                }
                            />
                        }
                    >
                        <EllipsisIcon />
                    </TooltipTrigger>
                </AnimateIcon>
                <TooltipContent>{t("session.actions")}</TooltipContent>
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
    const selectOnMount = useCallback((el: HTMLInputElement | null) => {
        el?.select();
    }, []);

    const commit = (value: string) => {
        const title = value.trim();
        setEditing(false);
        if (title !== "" && title !== session.title) {
            onRename(session.id, title);
        }
    };

    if (editing) {
        return (
            <SidebarMenuItem>
                <SidebarInput
                    ref={selectOnMount}
                    defaultValue={session.title}
                    aria-label={t("session.rename")}
                    onBlur={(e) => {
                        commit(e.currentTarget.value);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            commit(e.currentTarget.value);
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
                        ? t("sidebar.newSession")
                        : session.title}
                </span>
            </SidebarMenuButton>
            <SessionActions>
                <AnimateIcon animateOnHover asChild>
                    <DropdownMenuItem onClick={() => setEditing(true)}>
                        <PencilIcon />
                        {t("session.rename")}
                    </DropdownMenuItem>
                </AnimateIcon>
                <AnimateIcon animateOnHover asChild>
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDelete(session.id)}
                    >
                        <Trash2Icon />
                        {t("session.delete")}
                    </DropdownMenuItem>
                </AnimateIcon>
            </SessionActions>
        </SidebarMenuItem>
    );
}

const SKELETON_ROW_WIDTHS = ["w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/4"];

/** Session groups by recency; skeleton rows until the first load ends. */
export function SessionGroups({
    sessions,
    loaded,
    activeSessionId,
    onOpenSession,
    onRenameSession,
    onDeleteSession,
}: SessionGroupsProps) {
    const { t } = useTranslation();
    const { setOpenMobile } = useSidebar();
    const groups = useMemo(() => groupSessions(sessions), [sessions]);

    if (!loaded) {
        return (
            <output
                aria-label={t("common.loading")}
                className="flex flex-col p-2 pt-10"
            >
                {SKELETON_ROW_WIDTHS.map((width) => (
                    <div key={width} className="flex h-7.5 items-center px-1.5">
                        <div className={width}>
                            <Skeleton surface="sidebar" className="h-3.5" />
                        </div>
                    </div>
                ))}
            </output>
        );
    }

    return (
        <>
            {groups.map((group) => (
                <SidebarGroup key={group.key}>
                    <SidebarGroupLabel>
                        {t(`session.${group.key}`)}
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
