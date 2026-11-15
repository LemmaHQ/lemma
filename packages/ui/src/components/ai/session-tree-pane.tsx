import { type TreePaneRow, TreePaneRowView } from "#ai/tree-pane-row";
import { DrawerHeadingContext } from "#hooks/use-drawer-heading";
import { SearchIcon } from "#icons/search";
import { XIcon } from "#icons/x";
import { cn } from "#lib/cn";
import { Button } from "#primitives/button";
import {
    type KeyboardEvent,
    useContext,
    useId,
    useMemo,
    useState,
} from "react";
export type { TreePaneRow, TreeRailSegment } from "#ai/tree-pane-row";

type TreePaneFilter = "all" | "questions" | "labeled";

export type SessionTreePaneLabels = {
    verb: string;
    title: string;
    hint: string;
    pathsLabel: string;
    closeLabel: string;
    searchPlaceholder: string;
    emptyText: string;
    filterAll: string;
    filterQuestions: string;
    filterLabeled: string;
    addLabel: string;
    editLabel: string;
    labelPlaceholder: string;
};

type SessionTreePaneProps = {
    rows: TreePaneRow[];
    labels: SessionTreePaneLabels;
    onSelectRow: (id: string) => void;
    onSaveLabel?: ((id: string, label: string) => void) | undefined;
    onClose: () => void;
    className?: string | undefined;
};

/** Session branch tree drawer with 52px header, combobox search, filter pills, fork rail geometry, and inline labeling. */
export function SessionTreePane({
    rows,
    labels,
    onSelectRow,
    onSaveLabel,
    onClose,
    className,
}: SessionTreePaneProps) {
    const headingId = useContext(DrawerHeadingContext);
    const listboxId = useId();
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<TreePaneFilter>("all");
    const [cursor, setCursor] = useState(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState("");

    const visibleRows = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return rows.filter((row) => {
            if (filter === "questions" && row.kind !== "question") {
                return false;
            }
            if (
                filter === "labeled" &&
                (row.label === undefined || row.label.trim() === "")
            ) {
                return false;
            }
            if (needle === "") {
                return true;
            }
            return (
                row.title.toLowerCase().includes(needle) ||
                (row.label?.toLowerCase().includes(needle) ?? false)
            );
        });
    }, [rows, filter, query]);

    const safeCursor =
        visibleRows.length === 0
            ? -1
            : Math.min(cursor, visibleRows.length - 1);
    const activeRow = visibleRows[safeCursor];
    const handleNavigationKeyDown = (
        event: KeyboardEvent<HTMLInputElement>,
    ) => {
        if (event.key === "ArrowDown" && visibleRows.length > 0) {
            event.preventDefault();
            setCursor((current) => (current + 1) % visibleRows.length);
        } else if (event.key === "ArrowUp" && visibleRows.length > 0) {
            event.preventDefault();
            setCursor(
                (current) =>
                    (current - 1 + visibleRows.length) % visibleRows.length,
            );
        } else if (event.key === "Enter" && activeRow !== undefined) {
            event.preventDefault();
            onSelectRow(activeRow.id);
        }
    };

    const filters: readonly { id: TreePaneFilter; label: string }[] = [
        { id: "all", label: labels.filterAll },
        { id: "questions", label: labels.filterQuestions },
        { id: "labeled", label: labels.filterLabeled },
    ];

    return (
        <div
            data-slot="session-tree-pane"
            className={cn("flex min-h-0 flex-1 flex-col", className)}
        >
            <header className="flex h-13 shrink-0 items-center gap-3 border-b border-border px-4">
                <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-caption font-medium text-muted-foreground">
                    {labels.verb}
                </span>
                <h2
                    id={headingId}
                    className="min-w-0 truncate text-body font-medium text-foreground"
                >
                    {labels.title}
                </h2>
                <span className="min-w-0 flex-1 truncate text-caption text-subtle-foreground">
                    {labels.hint}
                </span>
                <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
                    {labels.pathsLabel}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={labels.closeLabel}
                    onClick={onClose}
                >
                    <XIcon />
                </Button>
            </header>
            <div className="flex flex-col gap-2 border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2 rounded-md border border-input bg-control px-2.5 py-1.5">
                    <SearchIcon
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-subtle-foreground"
                    />
                    <input
                        type="search"
                        aria-controls={listboxId}
                        value={query}
                        onKeyDown={handleNavigationKeyDown}
                        onChange={(event) => {
                            setQuery(event.currentTarget.value);
                            setCursor(0);
                        }}
                        placeholder={labels.searchPlaceholder}
                        aria-label={labels.searchPlaceholder}
                        className="w-full bg-transparent text-small text-foreground outline-none placeholder:text-subtle-foreground"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {filters.map((item) => {
                        const active = filter === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => {
                                    setFilter(item.id);
                                    setCursor(0);
                                }}
                                className={cn(
                                    "cursor-pointer rounded-full px-2.5 py-0.5 text-caption transition-colors duration-base",
                                    active
                                        ? "bg-selected font-medium text-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                )}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div id={listboxId} className="min-h-0 flex-1 overflow-y-auto p-2">
                {visibleRows.length === 0 ? (
                    <div className="px-2 py-8 text-center text-small text-muted-foreground">
                        {labels.emptyText}
                    </div>
                ) : (
                    visibleRows.map((row, index) => (
                        <TreePaneRowView
                            key={row.id}
                            row={row}
                            active={index === safeCursor}
                            isEditing={editingId === row.id}
                            draft={draft}
                            labels={labels}
                            onSelect={() => onSelectRow(row.id)}
                            onStartEdit={
                                onSaveLabel === undefined
                                    ? undefined
                                    : () => {
                                          setEditingId(row.id);
                                          setDraft(row.label ?? "");
                                      }
                            }
                            onDraftChange={setDraft}
                            onCommitEdit={() => {
                                onSaveLabel?.(row.id, draft.trim());
                                setEditingId(null);
                            }}
                            onCancelEdit={() => setEditingId(null)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
