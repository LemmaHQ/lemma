import { cn } from "cn";
import { type ReactNode, useId, useState } from "react";

import { CodeBlockSection } from "#ai/code-block";
import { ToolCallStatusIcon, ToolIcon } from "#ai/tool-call-icon";
import { useStopwatch } from "#hooks/use-stopwatch";
import { ChevronDownIcon } from "#icons/chevron-down";
import { CircleAlertIcon } from "#icons/circle-alert";
import { formatDuration } from "#lib/format-duration";

export type ToolCallStatus = "running" | "success" | "error";

export type ToolCallLabels = {
    failed: string;
    arguments: string;
    copyArguments: string;
    output: string;
    copyResult: string;
    waiting: string;
    copied: string;
    showAll: string;
    showLess: string;
};

/** `announcement` is read to screen readers when it changes; `error` shows while `status` is `"error"`. */
export type ToolCallCardProps = {
    name: string;
    summary?: ReactNode;
    icon?: ReactNode;
    status: ToolCallStatus;
    labels: ToolCallLabels;
    announcement: string;
    args?: unknown;
    result?: unknown;
    error?: string | undefined;
    startedAt?: number | undefined;
    finishedAt?: number | undefined;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    openOnError?: boolean;
    maxCodeHeight?: number;
    className?: string;
};

export function ToolCallCard({
    name,
    summary,
    icon,
    status,
    labels,
    announcement,
    args,
    result,
    error,
    startedAt,
    finishedAt,
    defaultOpen = false,
    open: openProp,
    onOpenChange,
    openOnError = true,
    maxCodeHeight = 220,
    className,
}: ToolCallCardProps) {
    const id = useId();
    const [openState, setOpenState] = useState(
        defaultOpen || (openOnError && status === "error"),
    );
    const [autoOpened, setAutoOpened] = useState(
        !defaultOpen && openOnError && status === "error",
    );
    const [previousStatus, setPreviousStatus] = useState(status);
    const open = openProp ?? openState;
    const elapsed = useStopwatch(startedAt, finishedAt);

    if (status !== previousStatus) {
        setPreviousStatus(status);
        if (openProp === undefined && openOnError) {
            if (status === "error" && !openState) {
                setOpenState(true);
                setAutoOpened(true);
            } else if (
                previousStatus === "error" &&
                status !== "error" &&
                autoOpened
            ) {
                setOpenState(false);
                setAutoOpened(false);
            }
        }
    }

    const setOpen = (next: boolean) => {
        setAutoOpened(false);
        if (openProp === undefined) {
            setOpenState(next);
        }
        onOpenChange?.(next);
    };
    const codeLabels = {
        copied: labels.copied,
        showAll: labels.showAll,
        showLess: labels.showLess,
    };
    const duration =
        elapsed === undefined
            ? null
            : formatDuration(elapsed, status === "running");

    return (
        <div
            className={cn(
                "group/tool min-w-0 rounded-xl border bg-card text-sm text-muted-foreground",
                className,
            )}
            data-open={open}
            data-status={status}
        >
            <span className="sr-only" role="status" aria-live="polite">
                {announcement}
            </span>
            <button
                type="button"
                className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl p-2 text-left transition-colors duration-base hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                aria-expanded={open}
                aria-controls={`${id}-body`}
                onClick={() => setOpen(!open)}
            >
                <ToolIcon icon={icon} />
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <code className="max-w-[55%] truncate font-mono text-xs font-medium text-foreground">
                        {name}
                    </code>
                    {summary !== undefined && summary !== null && (
                        <span className="min-w-0 flex-1 truncate text-xs">
                            {summary}
                        </span>
                    )}
                </span>
                <span
                    key={status}
                    className={cn(
                        "flex flex-none animate-blur-in items-center gap-1.5 text-xs tabular-nums",
                        status === "error" && "text-destructive",
                    )}
                >
                    <ToolCallStatusIcon status={status} />
                    {status === "error" ? labels.failed : duration}
                </span>
                <ChevronDownIcon className="size-3.5 flex-none text-muted-foreground transition-transform duration-reveal ease-enter group-data-[open=true]/tool:rotate-180 motion-reduce:transition-none" />
            </button>
            <div
                id={`${id}-body`}
                className="grid-collapse"
                data-open={open}
                inert={!open}
            >
                <div>
                    <div className="grid gap-3 border-t p-3">
                        {status === "error" && (
                            <div className="flex items-start gap-2 rounded-lg border border-destructive-border bg-destructive-subtle p-2.5 text-destructive">
                                <CircleAlertIcon className="mt-0.5 size-3.5 flex-none" />
                                <p className="min-w-0 flex-1 text-xs wrap-break-word">
                                    {error}
                                </p>
                            </div>
                        )}
                        {args !== undefined && (
                            <CodeBlockSection
                                cap={maxCodeHeight}
                                labels={{
                                    ...codeLabels,
                                    copy: labels.copyArguments,
                                }}
                                label={labels.arguments}
                                value={args}
                            />
                        )}
                        {result === undefined ? (
                            status === "running" ? (
                                <div className="grid gap-1.5">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {labels.output}
                                    </span>
                                    <p className="m-0 text-xs text-muted-foreground">
                                        {labels.waiting}
                                    </p>
                                </div>
                            ) : null
                        ) : (
                            <CodeBlockSection
                                cap={maxCodeHeight}
                                labels={{
                                    ...codeLabels,
                                    copy: labels.copyResult,
                                }}
                                label={labels.output}
                                value={result}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
