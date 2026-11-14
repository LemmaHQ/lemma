import { cn } from "#lib/cn";

export type TreeRailSegment = "tee" | "bar" | "empty";

export type TreePaneRow = {
    id: string;
    kind: "question" | "answer";
    title: string;
    label?: string;
    meta?: string;
    rails: TreeRailSegment[];
    hasTopSpine?: boolean;
    hasBottomSpine?: boolean;
    onPath?: boolean;
    isLeaf?: boolean;
};

export type TreePaneRowLabels = {
    addLabel: string;
    editLabel: string;
    labelPlaceholder: string;
};

function TreeRowRail({ row }: { row: TreePaneRow }) {
    const railItems = row.rails.map((segment, depth) => ({
        slotKey: `${row.id}-${depth}`,
        segment,
    }));
    return (
        <span aria-hidden="true" className="flex shrink-0 self-stretch">
            {railItems.map((item) => (
                <span
                    key={item.slotKey}
                    className="relative w-4 shrink-0 self-stretch"
                >
                    {item.segment !== "empty" && (
                        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
                    )}
                    {item.segment === "tee" && (
                        <span className="absolute top-1/2 right-0 left-1/2 h-px -translate-y-1/2 bg-border" />
                    )}
                </span>
            ))}
            <span className="relative flex w-4 shrink-0 items-center justify-center self-stretch">
                {row.hasTopSpine === true && (
                    <span
                        className={cn(
                            "absolute top-0 bottom-1/2 left-1/2 w-px -translate-x-1/2",
                            row.onPath === true ? "bg-brand" : "bg-border",
                        )}
                    />
                )}
                {row.hasBottomSpine === true && (
                    <span
                        className={cn(
                            "absolute top-1/2 bottom-0 left-1/2 w-px -translate-x-1/2",
                            row.onPath === true ? "bg-brand" : "bg-border",
                        )}
                    />
                )}
                {row.isLeaf === true ? (
                    <span className="relative z-10 size-[7px] bg-completion" />
                ) : (
                    <span
                        className={cn(
                            "relative z-10 size-1.5 rounded-full",
                            row.onPath === true
                                ? "bg-brand"
                                : "bg-muted-foreground",
                        )}
                    />
                )}
            </span>
        </span>
    );
}

/** Single row in `SessionTreePane` with 16px fork rails and optional inline label editing. */
export function TreePaneRowView({
    row,
    active,
    isEditing,
    draft,
    labels,
    onHover,
    onSelect,
    onStartEdit,
    onDraftChange,
    onCommitEdit,
    onCancelEdit,
}: {
    row: TreePaneRow;
    active: boolean;
    isEditing: boolean;
    draft: string;
    labels: TreePaneRowLabels;
    onHover: () => void;
    onSelect: () => void;
    onStartEdit?: () => void;
    onDraftChange: (value: string) => void;
    onCommitEdit: () => void;
    onCancelEdit: () => void;
}) {
    const hasLabel = row.label !== undefined && row.label !== "";

    return (
        <div
            data-active={active ? "" : undefined}
            onMouseEnter={onHover}
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
                        row.onPath === true
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
            {onStartEdit !== undefined &&
                (isEditing ? (
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
                        placeholder={labels.labelPlaceholder}
                        aria-label={labels.labelPlaceholder}
                        className="w-28 shrink-0 rounded-sm border border-input bg-control px-1.5 py-0.5 text-caption text-foreground outline-none focus:border-ring"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={onStartEdit}
                        className="shrink-0 cursor-pointer text-caption text-subtle-foreground opacity-0 transition-opacity duration-base group-focus-within:opacity-100 group-hover:opacity-100 hover:text-foreground"
                    >
                        {hasLabel ? labels.editLabel : labels.addLabel}
                    </button>
                ))}
        </div>
    );
}
