import { ChevronRightIcon } from "#icons/chevron-right";
import { cn } from "#lib/cn";
import { useId } from "react";

export type StepTimelineRow = {
    id: string;
    verb: string;
    argument: string;
    plainArgument?: boolean | undefined;
    meta?: string | undefined;
    warn?: boolean | undefined;
    via?: string | undefined;
    active?: boolean | undefined;
    onSelect?: (() => void) | undefined;
};

type StepTimelineProps = {
    summary: string;
    outcome?: string | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rows: StepTimelineRow[];
    className?: string | undefined;
};

/** Collapsible step summary bar expanding into compact tool-execution rows. */
export function StepTimeline({
    summary,
    outcome,
    open,
    onOpenChange,
    rows,
    className,
}: StepTimelineProps) {
    const listId = useId();

    return (
        <div
            data-slot="step-timeline"
            data-open={open}
            className={cn("flex flex-col", className)}
        >
            <button
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => onOpenChange(!open)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-small text-muted-foreground transition-colors duration-base hover:bg-accent hover:text-foreground"
            >
                <ChevronRightIcon
                    aria-hidden="true"
                    className={cn(
                        "size-3.5 shrink-0 transition-transform duration-base ease-enter motion-reduce:transition-none",
                        open && "rotate-90",
                    )}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                    {summary}
                </span>
                {outcome !== undefined && (
                    <span className="shrink-0 text-caption text-subtle-foreground tabular-nums">
                        {outcome}
                    </span>
                )}
            </button>
            <div
                id={listId}
                className="grid-collapse"
                data-open={open}
                inert={!open}
            >
                <div>
                    <div className="flex flex-col gap-0.5 pt-1">
                        {rows.map((row) => {
                            const content = (
                                <>
                                    <span
                                        className={cn(
                                            "w-16 shrink-0 truncate text-caption font-medium",
                                            row.warn === true
                                                ? "text-warning"
                                                : "text-muted-foreground",
                                        )}
                                    >
                                        {row.verb}
                                    </span>
                                    <span
                                        className={cn(
                                            "min-w-0 flex-1 truncate text-foreground",
                                            row.plainArgument === true
                                                ? "text-small"
                                                : "font-mono text-caption",
                                        )}
                                    >
                                        {row.argument}
                                    </span>
                                    {row.via !== undefined && (
                                        <span className="shrink-0 text-caption text-subtle-foreground">
                                            {row.via}
                                        </span>
                                    )}
                                    {row.meta !== undefined && (
                                        <span className="shrink-0 text-caption text-subtle-foreground tabular-nums">
                                            {row.meta}
                                        </span>
                                    )}
                                </>
                            );

                            const rowClass =
                                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors duration-base data-active:bg-selected";

                            if (row.onSelect !== undefined) {
                                return (
                                    <button
                                        key={row.id}
                                        type="button"
                                        data-active={
                                            row.active === true ? "" : undefined
                                        }
                                        onClick={row.onSelect}
                                        className={cn(
                                            rowClass,
                                            "cursor-pointer hover:bg-accent",
                                        )}
                                    >
                                        {content}
                                    </button>
                                );
                            }

                            return (
                                <div
                                    key={row.id}
                                    data-active={
                                        row.active === true ? "" : undefined
                                    }
                                    className={rowClass}
                                >
                                    {content}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
