import { cn } from "cn";
import {
    Children,
    type ReactNode,
    isValidElement,
    useId,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import type { ToolCallCardProps } from "#components/ai-elements/tool";
import { ToolIcon } from "#components/ai-elements/tool-call-icon";
import { useStopwatch } from "#hooks/use-stopwatch";
import { ChevronDownIcon } from "#icons/chevron-down";
import { formatDuration } from "@lemma/ui/lib/format-duration";

export type ToolCallGroupProps = {
    children: ReactNode;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    className?: string;
};

export function ToolCallGroup({
    children,
    defaultOpen = false,
    open: openProp,
    onOpenChange,
    className,
}: ToolCallGroupProps) {
    const { t } = useTranslation("ui");
    const id = useId();
    const [openState, setOpenState] = useState(defaultOpen);
    const open = openProp ?? openState;
    const calls = Children.toArray(children)
        .filter(isValidElement<Partial<ToolCallCardProps>>)
        .map((child) => child.props);
    const running = calls.some((call) => call.status === "running");
    const failed = calls.filter((call) => call.status === "error").length;
    const activeStarts = calls
        .filter((call) => call.status === "running")
        .map((call) => call.startedAt)
        .filter((startedAt): startedAt is number => startedAt !== undefined);
    const activeStartedAt =
        activeStarts.length > 0 ? Math.min(...activeStarts) : undefined;
    const activeElapsed = useStopwatch(activeStartedAt);
    const now =
        activeStartedAt !== undefined && activeElapsed !== undefined
            ? activeStartedAt + activeElapsed
            : undefined;
    const durations = calls.map((call) => {
        if (call.startedAt === undefined) {
            return null;
        }
        if (call.finishedAt !== undefined) {
            return Math.max(0, call.finishedAt - call.startedAt);
        }
        return call.status === "running" && now !== undefined
            ? Math.max(0, now - call.startedAt)
            : null;
    });
    const total =
        calls.length > 0 && durations.every((duration) => duration !== null)
            ? durations.reduce((sum, duration) => sum + duration, 0)
            : undefined;
    const title = t(
        running ? "agent.toolGroup.running" : "agent.toolGroup.used",
        { count: calls.length },
    );
    const icons = Children.toArray(children)
        .filter(isValidElement<Partial<ToolCallCardProps>>)
        .slice(-3);

    return (
        <div className={cn("tool-call-group grid", className)} data-open={open}>
            <span className="sr-only" role="status" aria-live="polite">
                {title}
            </span>
            <button
                type="button"
                className="flex min-h-9 max-w-full cursor-pointer items-center justify-self-start gap-2 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors duration-base hover:bg-muted/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                aria-expanded={open}
                aria-controls={`${id}-list`}
                onClick={() => {
                    if (openProp === undefined) {
                        setOpenState(!open);
                    }
                    onOpenChange?.(!open);
                }}
            >
                <span className="flex flex-none -space-x-1" aria-hidden="true">
                    {icons.map((call) => (
                        <ToolIcon
                            key={call.key ?? call.props.name}
                            className="animate-pop ring-2 ring-background"
                            icon={call.props.icon}
                            small
                        />
                    ))}
                </span>
                <span
                    key={running ? "running" : "done"}
                    className="flex min-w-0 animate-blur-in items-baseline gap-1.5 whitespace-nowrap"
                >
                    <span
                        className={cn(
                            "truncate font-medium",
                            running && "text-sweep",
                        )}
                    >
                        {title}
                    </span>
                    {failed > 0 && (
                        <span className="flex-none text-destructive">
                            · {t("agent.toolGroup.failed", { count: failed })}
                        </span>
                    )}
                    {total !== undefined && (
                        <span className="flex-none tabular-nums">
                            · {formatDuration(total, running)}
                        </span>
                    )}
                </span>
                <ChevronDownIcon className="tool-call-chevron size-3.5 flex-none" />
            </button>
            <div
                id={`${id}-list`}
                className="grid-collapse"
                data-open={open}
                inert={!open}
            >
                <div>
                    <div className="grid gap-2 pt-2">{children}</div>
                </div>
            </div>
        </div>
    );
}
