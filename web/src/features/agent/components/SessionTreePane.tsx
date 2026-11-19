import { cn, DrawerHeader, SearchIcon } from "@lemma/ui";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import type { SessionTreeRow } from "../session-tree";
import { TreePaneRow } from "./TreePaneRow";

type TreePaneFilter = "all" | "questions" | "labeled";

const FILTERS = [
    { id: "all", label: "session.treeFilterAll" },
    { id: "questions", label: "session.treeFilterQuestions" },
    { id: "labeled", label: "session.treeFilterLabeled" },
] as const;

/** Session branch tree drawer with combobox search, filter pills, fork rails, and inline labeling. */
export function SessionTreePane({
    rows,
    pathCount,
    onSelectRow,
    onSaveLabel,
    onClose,
}: {
    rows: SessionTreeRow[];
    pathCount: number;
    onSelectRow: (id: string) => void;
    onSaveLabel: (id: string, label: string) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
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

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <DrawerHeader
                verb={t("session.treeVerb")}
                title={t("session.treeTitle")}
                closeLabel={t("common.close")}
                meta={
                    <span className="text-caption text-muted-foreground tabular-nums">
                        {t("session.treePaths", { count: pathCount })}
                    </span>
                }
                onClose={onClose}
            >
                <span className="min-w-0 flex-1 truncate text-caption text-subtle-foreground">
                    {t("session.treeHint")}
                </span>
            </DrawerHeader>
            <div className="flex flex-col gap-2 border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2 rounded-md border border-input bg-control px-2.5 py-1.5">
                    <span
                        aria-hidden="true"
                        className="inline-flex shrink-0 text-subtle-foreground"
                    >
                        <SearchIcon className="size-3.5" />
                    </span>
                    <input
                        type="search"
                        aria-controls={listboxId}
                        value={query}
                        onKeyDown={handleNavigationKeyDown}
                        onChange={(event) => {
                            setQuery(event.currentTarget.value);
                            setCursor(0);
                        }}
                        placeholder={t("session.treeSearchPlaceholder")}
                        aria-label={t("session.treeSearchPlaceholder")}
                        className="w-full bg-transparent text-small text-foreground outline-none placeholder:text-subtle-foreground"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {FILTERS.map((item) => {
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
                                {t(item.label)}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div id={listboxId} className="min-h-0 flex-1 overflow-y-auto p-2">
                {visibleRows.length === 0 ? (
                    <div className="px-2 py-8 text-center text-small text-muted-foreground">
                        {t("session.treeEmpty")}
                    </div>
                ) : (
                    visibleRows.map((row, index) => (
                        <TreePaneRow
                            key={row.id}
                            row={row}
                            active={index === safeCursor}
                            isEditing={editingId === row.id}
                            draft={draft}
                            onSelect={() => onSelectRow(row.id)}
                            onStartEdit={() => {
                                setEditingId(row.id);
                                setDraft(row.label ?? "");
                            }}
                            onDraftChange={setDraft}
                            onCommitEdit={() => {
                                onSaveLabel(row.id, draft.trim());
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
