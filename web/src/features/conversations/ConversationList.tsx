import { Archive, ChevronRight, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

function SessionRow({
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
        if (title && title !== session.title) onRename(session.id, title);
    };

    if (editing) {
        return (
            <Input
                ref={focusRef}
                defaultValue={session.title}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        commit();
                    } else if (e.key === "Escape") {
                        setEditing(false);
                    }
                }}
                className="h-7 rounded-md px-3 text-sm"
            />
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen(session.id)}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(session.id);
                }
            }}
            className={cn(
                "group flex w-full cursor-pointer items-center truncate rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent/60",
                active && "bg-sidebar-accent font-medium",
            )}
        >
            <span className="flex-1 truncate text-left">
                {session.title || t("sidebar.newChat")}
            </span>
            <span className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                    type="button"
                    aria-label={t("sessions.rename")}
                    title={t("sessions.rename")}
                    onClick={(e) => {
                        e.stopPropagation();
                        setEditing(true);
                    }}
                    className="grid size-5 place-items-center rounded text-muted-foreground hover:text-foreground"
                >
                    <Pencil className="size-3" />
                </button>
                <button
                    type="button"
                    aria-label={t("sessions.archive")}
                    title={t("sessions.archive")}
                    onClick={(e) => {
                        e.stopPropagation();
                        onArchive(session.id);
                    }}
                    className="grid size-5 place-items-center rounded text-muted-foreground hover:text-foreground"
                >
                    <Archive className="size-3.5" />
                </button>
            </span>
        </div>
    );
}

function ArchivedRow({
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
        <div className="group flex w-full items-center truncate rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent/60">
            <span className="flex-1 truncate text-left text-muted-foreground">
                {session.title || t("sidebar.newChat")}
            </span>
            <span className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                    type="button"
                    aria-label={t("sessions.restore")}
                    title={t("sessions.restore")}
                    onClick={() => onRestore(session.id)}
                    className="grid size-5 place-items-center rounded text-muted-foreground hover:text-foreground"
                >
                    <RotateCcw className="size-3" />
                </button>
                <button
                    type="button"
                    aria-label={t("sessions.delete")}
                    title={t("sessions.delete")}
                    onClick={() => onDelete(session.id)}
                    className="grid size-5 place-items-center rounded text-muted-foreground hover:text-destructive"
                >
                    <Trash2 className="size-3.5" />
                </button>
            </span>
        </div>
    );
}

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
        <div className="flex-1 overflow-y-auto px-2 pb-3">
            {groups.map((group) => (
                <div key={group.key}>
                    <p className="px-3 pt-4 pb-1 text-xs text-muted-foreground">
                        {t(`sessions.${group.key}`)}
                    </p>
                    <div className="space-y-0.5">
                        {group.items.map((session) => (
                            <SessionRow
                                key={session.id}
                                session={session}
                                active={session.id === activeSessionId}
                                onOpen={onOpenSession}
                                onArchive={onArchiveSession}
                                onRename={onRenameSession}
                            />
                        ))}
                    </div>
                </div>
            ))}

            {archived.length > 0 && (
                <Collapsible>
                    <CollapsibleTrigger className="group flex w-full items-center gap-1 px-3 pt-4 pb-1 text-xs text-muted-foreground">
                        <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
                        {t("sessions.archived")} ({archived.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="space-y-0.5">
                            {archived.map((session) => (
                                <ArchivedRow
                                    key={session.id}
                                    session={session}
                                    onRestore={onRestoreSession}
                                    onDelete={onDeleteSession}
                                />
                            ))}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </div>
    );
}
