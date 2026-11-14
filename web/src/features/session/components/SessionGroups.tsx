import {
    AnimateIcon,
    ChevronRightIcon,
    cn,
    PlusIcon,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    Skeleton,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    useSidebar,
} from "@lemma/ui";
import { type Dispatch, type SetStateAction, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    directoryBasename,
    groupSessions,
    type SessionSummary,
    visibleDirectorySessions,
} from "../grouping";
import { useSessions } from "../useSessions";
import { SessionItem } from "./SessionItem";

interface SessionGroupsProps {
    activeSessionId?: string | undefined;
    activeNewDirectory?: string | undefined;
    isNewSessionView: boolean;
    onOpenSession: (id: string) => void;
    onNewInDirectory?: ((directory: string | undefined) => void) | undefined;
    onRequestRename: (session: SessionSummary) => void;
    onDeleteSession: (id: string) => void;
}

const SKELETON_ROW_WIDTHS = ["w-4/5", "w-3/5", "w-2/3", "w-1/2", "w-3/4"];

function toggleSet(
    setState: Dispatch<SetStateAction<Set<string>>>,
    key: string,
) {
    setState((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        return next;
    });
}

function DirectoryToggle({
    directory,
    label,
    panelId,
    collapsed,
    highlighted,
    onToggle,
}: {
    directory: string;
    label: string;
    panelId: string;
    collapsed: boolean;
    highlighted: boolean;
    onToggle: () => void;
}) {
    const button = (
        <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={panelId}
            onClick={onToggle}
            className={cn(
                "flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-sm text-left text-caption ring-sidebar-ring outline-hidden hover:text-foreground focus-visible:ring-2",
                highlighted
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
            )}
        >
            <span
                className={cn(
                    "inline-flex shrink-0 transition-transform duration-base ease-move motion-reduce:transition-none",
                    !collapsed && "rotate-90",
                )}
            >
                <ChevronRightIcon className="size-3.5" />
            </span>
            <span className="truncate">{label}</span>
        </button>
    );

    if (directory === "") {
        return button;
    }

    return (
        <Tooltip>
            <TooltipTrigger render={button} />
            <TooltipContent side="right">{directory}</TooltipContent>
        </Tooltip>
    );
}

/** Session groups by directory; skeleton rows until the first load ends. */
export function SessionGroups({
    activeSessionId,
    activeNewDirectory,
    isNewSessionView,
    onOpenSession,
    onNewInDirectory,
    onRequestRename,
    onDeleteSession,
}: SessionGroupsProps) {
    const { t } = useTranslation();
    const idPrefix = useId();
    const { setOpenMobile } = useSidebar();
    const {
        list: sessions,
        loaded,
        unseenDoneIds,
        erroredIds,
        markSeen,
    } = useSessions((s) => ({
        list: s.list,
        loaded: s.loaded,
        unseenDoneIds: s.unseenDoneIds,
        erroredIds: s.erroredIds,
        markSeen: s.markSeen,
    }));
    const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(
        () => new Set(),
    );
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
        () => new Set(),
    );

    if (!loaded) {
        return (
            <output
                aria-label={t("common.loading")}
                className="flex flex-col p-2 pt-10"
            >
                {SKELETON_ROW_WIDTHS.map((width) => (
                    <div key={width} className="flex h-8 items-center px-2">
                        <div className={width}>
                            <Skeleton surface="sidebar" className="h-3.5" />
                        </div>
                    </div>
                ))}
            </output>
        );
    }

    const groups = groupSessions(sessions);

    return (
        <>
            {groups.map((group, groupIndex) => {
                const panelId = `${idPrefix}-${groupIndex}`;
                const collapsed = collapsedDirs.has(group.directory);
                const expanded = expandedDirs.has(group.directory);
                const { visible, hiddenCount } = visibleDirectorySessions(
                    group.items,
                    expanded,
                );
                const label = directoryBasename(
                    group.directory,
                    t("sidebar.defaultWorkspace"),
                );
                const highlighted =
                    isNewSessionView &&
                    group.directory === (activeNewDirectory ?? "");

                return (
                    <SidebarGroup key={group.directory}>
                        <div className="group/dir flex h-7 items-center gap-1 rounded-md px-2">
                            <DirectoryToggle
                                directory={group.directory}
                                label={label}
                                panelId={panelId}
                                collapsed={collapsed}
                                highlighted={highlighted}
                                onToggle={() =>
                                    toggleSet(setCollapsedDirs, group.directory)
                                }
                            />
                            {onNewInDirectory !== undefined && (
                                <Tooltip>
                                    <AnimateIcon animateOnHover asChild>
                                        <TooltipTrigger
                                            render={
                                                <button
                                                    type="button"
                                                    aria-label={t(
                                                        "sidebar.newInFolder",
                                                        { folder: label },
                                                    )}
                                                    onClick={() =>
                                                        onNewInDirectory(
                                                            group.directory ===
                                                                ""
                                                                ? undefined
                                                                : group.directory,
                                                        )
                                                    }
                                                    className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-100 ring-sidebar-ring outline-hidden transition-opacity duration-base group-focus-within/dir:opacity-100 group-hover/dir:opacity-100 hover:bg-sidebar-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 md:opacity-0"
                                                />
                                            }
                                        >
                                            <PlusIcon className="size-3.5" />
                                        </TooltipTrigger>
                                    </AnimateIcon>
                                    <TooltipContent>
                                        {t("sidebar.newInFolder", {
                                            folder: label,
                                        })}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                        <div
                            id={panelId}
                            className="grid-collapse"
                            data-open={!collapsed}
                            inert={collapsed}
                        >
                            <div>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        {visible.map((session) => (
                                            <SessionItem
                                                key={session.id}
                                                session={session}
                                                active={
                                                    session.id ===
                                                    activeSessionId
                                                }
                                                unseenDone={
                                                    session.id !==
                                                        activeSessionId &&
                                                    unseenDoneIds.has(
                                                        session.id,
                                                    )
                                                }
                                                errored={erroredIds.has(
                                                    session.id,
                                                )}
                                                onOpen={(id) => {
                                                    markSeen(id);
                                                    setOpenMobile(false);
                                                    onOpenSession(id);
                                                }}
                                                onRequestRename={
                                                    onRequestRename
                                                }
                                                onDelete={onDeleteSession}
                                            />
                                        ))}
                                        {hiddenCount > 0 && (
                                            <SidebarMenuItem>
                                                <SidebarMenuButton
                                                    size="sm"
                                                    onClick={() =>
                                                        toggleSet(
                                                            setExpandedDirs,
                                                            group.directory,
                                                        )
                                                    }
                                                >
                                                    <span className="text-caption text-subtle-foreground">
                                                        {t(
                                                            "sidebar.moreSessions",
                                                            {
                                                                count: hiddenCount,
                                                            },
                                                        )}
                                                    </span>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        )}
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </div>
                        </div>
                    </SidebarGroup>
                );
            })}
        </>
    );
}
