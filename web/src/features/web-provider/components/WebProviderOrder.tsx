import {
    Button,
    ChevronDownIcon,
    ChevronUpIcon,
    cn,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui";
import type { TFunction } from "i18next";
import { useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";

import {
    isWebProviderActive,
    type WebFunction,
    type WebProvider,
} from "../store";

interface WebProviderOrderProps {
    fn: WebFunction;
    providers: WebProvider[];
    onReorder: (ids: string[]) => void;
}

/** Reorderable web backend list supporting drag-and-drop and step buttons. */
export function WebProviderOrder({
    fn,
    providers,
    onReorder,
}: WebProviderOrderProps) {
    const { t } = useTranslation();
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const dragType =
        fn === "search"
            ? "application/x-lemma-web-search"
            : "application/x-lemma-web-fetch";
    const ids = providers.map((provider) => provider.id);

    const rows: Array<{
        provider: WebProvider;
        active: boolean;
        rank: number | null;
    }> = [];
    let activeCount = 0;
    for (const provider of providers) {
        const active = isWebProviderActive(provider);
        if (active) {
            activeCount += 1;
        }
        rows.push({
            provider,
            active,
            rank: active ? activeCount : null,
        });
    }

    const resetDrag = () => {
        setDraggedId(null);
        setDropTargetId(null);
    };

    const handleDragStart = (event: DragEvent<HTMLDivElement>, id: string) => {
        setDraggedId(id);
        setDropTargetId(null);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(dragType, id);
    };

    const handleDragOver = (
        event: DragEvent<HTMLDivElement>,
        targetId: string,
    ) => {
        if (draggedId === null || draggedId === targetId) {
            return;
        }
        event.preventDefault();
        if (dropTargetId !== targetId) {
            setDropTargetId(targetId);
        }
    };

    const handleDragLeave = (targetId: string) => {
        if (dropTargetId === targetId) {
            setDropTargetId(null);
        }
    };

    const handleDrop = (
        event: DragEvent<HTMLDivElement>,
        targetIndex: number,
        targetId: string,
    ) => {
        if (draggedId === null) {
            return;
        }
        event.preventDefault();
        const sourceId = draggedId;
        resetDrag();
        if (sourceId === targetId) {
            return;
        }
        const fromIndex = ids.indexOf(sourceId);
        if (fromIndex === -1) {
            return;
        }
        onReorder(moveItem(ids, fromIndex, targetIndex));
    };

    return (
        <>
            {rows.map(({ provider, active, rank }, index) => (
                <div
                    key={provider.id}
                    data-slot="web-order-row"
                    data-provider={provider.kind}
                    draggable
                    onDragStart={(event) => handleDragStart(event, provider.id)}
                    onDragOver={(event) => handleDragOver(event, provider.id)}
                    onDragLeave={() => handleDragLeave(provider.id)}
                    onDrop={(event) => handleDrop(event, index, provider.id)}
                    onDragEnd={resetDrag}
                    className={cn(
                        "flex cursor-grab items-center gap-3 py-2.5 transition-opacity first:pt-0 active:cursor-grabbing pointer-coarse:cursor-default",
                        !active && "opacity-60",
                        dropTargetId === provider.id && "bg-accent",
                    )}
                >
                    <span className="w-5 shrink-0 text-center font-mono text-caption text-muted-foreground tabular-nums">
                        {rank ?? "–"}
                    </span>
                    <div className="flex min-w-0 flex-1 items-baseline gap-2">
                        <span className="truncate text-body font-medium text-foreground">
                            {provider.name}
                        </span>
                        <span className="shrink-0 text-caption text-muted-foreground">
                            {roleLabel(rank, t)}
                        </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <MoveButton
                            direction="up"
                            label={t("provider.webMoveUp", {
                                name: provider.name,
                            })}
                            disabled={index === 0}
                            onClick={() =>
                                onReorder(moveItem(ids, index, index - 1))
                            }
                        />
                        <MoveButton
                            direction="down"
                            label={t("provider.webMoveDown", {
                                name: provider.name,
                            })}
                            disabled={index === rows.length - 1}
                            onClick={() =>
                                onReorder(moveItem(ids, index, index + 1))
                            }
                        />
                    </div>
                </div>
            ))}
        </>
    );
}

function moveItem(ids: string[], fromIndex: number, toIndex: number): string[] {
    const next = [...ids];
    const moved = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, ...moved);
    return next;
}

function roleLabel(rank: number | null, t: TFunction): string {
    if (rank === null) {
        return t("provider.webRoleSkipped");
    }
    if (rank === 1) {
        return t("provider.webRolePrimary");
    }
    return t("provider.webRoleFallback", { rank });
}

interface MoveButtonProps {
    direction: "up" | "down";
    label: string;
    disabled: boolean;
    onClick: () => void;
}

function MoveButton({ direction, label, disabled, onClick }: MoveButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={label}
                        disabled={disabled}
                        onClick={onClick}
                    />
                }
            >
                {direction === "up" ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
