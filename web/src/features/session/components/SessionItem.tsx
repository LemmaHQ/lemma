import {
    AnimateIcon,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    EllipsisIcon,
    PencilIcon,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    Trash2Icon,
} from "@lemma/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { formatSessionTime, type SessionSummary } from "../grouping";

interface SessionItemProps {
    session: SessionSummary;
    active: boolean;
    unseenDone: boolean;
    errored: boolean;
    onOpen: (id: string) => void;
    onRequestRename: (session: SessionSummary) => void;
    onDelete: (id: string) => void;
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

function TrailingIndicator({
    active,
    activeMessageId,
    errored,
    unseenDone,
    timeText,
}: {
    active: boolean;
    activeMessageId?: string | undefined;
    errored: boolean;
    unseenDone: boolean;
    timeText: string;
}) {
    if (activeMessageId !== undefined) {
        return <span aria-hidden="true" className="live-dot shrink-0" />;
    }
    if (errored) {
        return (
            <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-none border border-completion"
            />
        );
    }
    if (unseenDone && !active) {
        return (
            <span
                aria-hidden="true"
                className="size-1.5 shrink-0 bg-completion"
            />
        );
    }
    if (timeText === "") {
        return null;
    }
    return (
        <span className="hidden shrink-0 text-caption text-subtle-foreground tabular-nums group-focus-within/menu-item:inline group-hover/menu-item:inline">
            {timeText}
        </span>
    );
}

/** Single session row with trailing live/error/unseen indicator, hover time, and actions menu. */
export function SessionItem({
    session,
    active,
    unseenDone,
    errored,
    onOpen,
    onRequestRename,
    onDelete,
}: SessionItemProps) {
    const { t } = useTranslation();
    const timeText = formatSessionTime(session.updatedAtMs);

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                isActive={active}
                onClick={() => onOpen(session.id)}
            >
                <span className="min-w-0 flex-1 truncate">
                    {session.title === ""
                        ? t("sidebar.newSession")
                        : session.title}
                </span>
                <TrailingIndicator
                    active={active}
                    activeMessageId={session.activeMessageId}
                    errored={errored}
                    unseenDone={unseenDone}
                    timeText={timeText}
                />
            </SidebarMenuButton>
            <SessionActions>
                <AnimateIcon animateOnHover asChild>
                    <DropdownMenuItem onClick={() => onRequestRename(session)}>
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
