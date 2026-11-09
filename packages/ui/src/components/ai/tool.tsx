import { cn } from "#lib/cn";
import { useId, useState } from "react";

import { CodeBlockSection } from "#ai/code-block";
import { ToolCallStatusIcon, ToolIcon } from "#ai/tool-call-icon";
import { Alert, AlertDescription } from "#primitives/alert";
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
    status: ToolCallStatus;
    labels: ToolCallLabels;
    announcement: string;
    args?: unknown;
    result?: unknown;
    error?: string | undefined;
    startedAt?: number | undefined;
    finishedAt?: number | undefined;
};

export function ToolCallCard({
    name,
    status,
    labels,
    announcement,
    args,
    result,
    error,
    startedAt,
    finishedAt,
}: ToolCallCardProps) {
    const id = useId();
    const [open, setOpen] = useState(status === "error");
    const [autoOpened, setAutoOpened] = useState(status === "error");
    const [previousStatus, setPreviousStatus] = useState(status);
    const elapsed = useStopwatch(startedAt, finishedAt);

    if (status !== previousStatus) {
        setPreviousStatus(status);
        if (status === "error" && !open) {
            setOpen(true);
            setAutoOpened(true);
        } else if (
            previousStatus === "error" &&
            status !== "error" &&
            autoOpened
        ) {
            setOpen(false);
            setAutoOpened(false);
        }
    }

    const toggleOpen = () => {
        setAutoOpened(false);
        setOpen(!open);
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
            className="group/tool min-w-0 rounded-lg border bg-card text-small text-muted-foreground"
            data-open={open}
            data-status={status}
        >
            <span className="sr-only" role="status" aria-live="polite">
                {announcement}
            </span>
            <button
                type="button"
                className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left transition-colors duration-base hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                aria-expanded={open}
                aria-controls={`${id}-body`}
                onClick={toggleOpen}
            >
                <ToolIcon />
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <code className="max-w-[55%] truncate font-mono text-caption font-medium text-foreground">
                        {name}
                    </code>
                </span>
                <span
                    key={status}
                    className={cn(
                        "flex flex-none animate-blur-in items-center gap-1.5 text-caption tabular-nums",
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
                            <Alert variant="destructive">
                                <CircleAlertIcon />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        {args !== undefined && (
                            <CodeBlockSection
                                cap={220}
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
                                    <span className="text-caption font-medium text-subtle-foreground">
                                        {labels.output}
                                    </span>
                                    <p className="m-0 text-caption text-subtle-foreground">
                                        {labels.waiting}
                                    </p>
                                </div>
                            ) : null
                        ) : (
                            <CodeBlockSection
                                cap={220}
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
