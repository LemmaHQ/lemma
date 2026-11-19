import { cn } from "@lemma/ui";
import { useTranslation } from "react-i18next";

import type { SessionTreeRow } from "../session-tree";

function TreeRowRail({ row }: { row: SessionTreeRow }) {
    const rails = row.rails.map((segment, depth) => ({
        key: `${row.id}-${depth}`,
        segment,
    }));
    return (
        <span aria-hidden="true" className="flex shrink-0 self-stretch">
            {rails.map(({ key, segment }) => (
                <span key={key} className="relative w-4 shrink-0 self-stretch">
                    {segment !== "empty" && (
                        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
                    )}
                    {segment === "tee" && (
                        <span className="absolute top-1/2 right-0 left-1/2 h-px -translate-y-1/2 bg-border" />
                    )}
                </span>
            ))}
            <span className="relative flex w-4 shrink-0 items-center justify-center self-stretch">
                {row.hasTopSpine && (
                    <span
                        className={cn(
                            "absolute top-0 bottom-1/2 left-1/2 w-px -translate-x-1/2",
                            row.onPath ? "bg-brand" : "bg-border",
                        )}
                    />
                )}
                {row.hasBottomSpine && (
                    <span
                        className={cn(
                            "absolute top-1/2 bottom-0 left-1/2 w-px -translate-x-1/2",
                            row.onPath ? "bg-brand" : "bg-border",
                        )}
                    />
                )}
                {row.isLeaf ? (
                    <span className="relative z-10 size-1.75 bg-completion" />
                ) : (
                    <span
                        className={cn(
                            "relative z-10 size-1.5 rounded-full",
                            row.onPath ? "bg-brand" : "bg-muted-foreground",
                        )}
                    />
                )}
            </span>
        </span>
    );
}

/** One row of the session tree drawer with 16px fork rails and optional inline label editing. */
export function TreePaneRow({
    row,
    active,
    isEditing,
    draft,
    onSelect,
    onStartEdit,
    onDraftChange,
    onCommitEdit,
    onCancelEdit,
}: {
    row: SessionTreeRow;
    active: boolean;
    isEditing: boolean;
    draft: string;
    onSelect: () => void;
    onStartEdit: () => void;
    onDraftChange: (value: string) => void;
    onCommitEdit: () => void;
    onCancelEdit: () => void;
}) {
    const { t } = useTranslation();
    const hasLabel = row.label !== undefined && row.label !== "";

    return (
        <div
            data-active={active ? "" : undefined}
            className="group flex min-h-8 items-center gap-2 rounded-md px-2 transition-colors duration-base hover:bg-accent data-active:bg-accent"
        >
            <TreeRowRail row={row} />
            <button
                type="button"
                onClick={onSelect}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 text-left"
            >
                <span
                    className={cn(
                        "min-w-0 flex-1 truncate text-small",
                        row.onPath
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                    )}
                >
                    {row.title}
                </span>
                {!isEditing && hasLabel && (
                    <span className="shrink-0 rounded-sm bg-selected px-1.5 py-0.5 text-caption text-foreground">
                        {row.label}
                    </span>
                )}
                {row.meta !== undefined && (
                    <span className="shrink-0 text-caption text-subtle-foreground tabular-nums">
                        {row.meta}
                    </span>
                )}
            </button>
            {isEditing ? (
                <input
                    type="text"
                    value={draft}
                    onChange={(event) =>
                        onDraftChange(event.currentTarget.value)
                    }
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            event.stopPropagation();
                            onCommitEdit();
                        } else if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            onCancelEdit();
                        }
                    }}
                    placeholder={t("session.treeLabelPlaceholder")}
                    aria-label={t("session.treeLabelPlaceholder")}
                    className="w-28 shrink-0 rounded-sm border border-input bg-control px-1.5 py-0.5 text-caption text-foreground outline-none focus:border-ring"
                />
            ) : (
                <button
                    type="button"
                    onClick={onStartEdit}
                    className="shrink-0 cursor-pointer text-caption text-subtle-foreground opacity-0 transition-opacity duration-base group-focus-within:opacity-100 group-hover:opacity-100 hover:text-foreground"
                >
                    {hasLabel
                        ? t("session.treeEditLabel")
                        : t("session.treeAddLabel")}
                </button>
            )}
        </div>
    );
}
