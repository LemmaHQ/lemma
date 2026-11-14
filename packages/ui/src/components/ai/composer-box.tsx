import { useStopwatch } from "#hooks/use-stopwatch";
import { cn } from "#lib/cn";
import { formatDuration } from "#lib/format-duration";
import { Button } from "#primitives/button";
import { CornerDownLeftIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";

export type ComposerRunningState = {
    stepLabel: string;
    startedAtMs: number;
    warn?: boolean;
    stopLabel: string;
    onStop: () => void;
};

export type ComposerBoxProps = {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: () => void;
    placeholder: string;
    sendLabel: string;
    disabled?: boolean;
    canSend?: boolean;
    dock?: ReactNode;
    footerStart?: ReactNode;
    running?: ComposerRunningState;
    className?: string;
};

/** 680px composer box with optional top dock, collapsible live status bar, and footer actions. */
export function ComposerBox({
    value,
    onChange,
    onSubmit,
    placeholder,
    sendLabel,
    disabled = false,
    canSend,
    dock,
    footerStart,
    running,
    className,
}: ComposerBoxProps) {
    const [isComposing, setIsComposing] = useState(false);
    const elapsed = useStopwatch(running?.startedAtMs);
    const sendAllowed = (canSend ?? value.trim().length > 0) && !disabled;

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (
            event.key !== "Enter" ||
            event.shiftKey ||
            isComposing ||
            event.nativeEvent.isComposing
        ) {
            return;
        }
        event.preventDefault();
        if (sendAllowed) {
            onSubmit?.();
        }
    };

    return (
        <div
            data-slot="composer-box"
            className={cn(
                "w-full max-w-170 overflow-hidden rounded-lg border border-input bg-background transition-colors duration-base focus-within:border-foreground",
                className,
            )}
        >
            {dock !== undefined && (
                <div
                    data-slot="composer-dock"
                    className="border-b border-border px-3 py-2"
                >
                    {dock}
                </div>
            )}
            <div
                data-slot="composer-running"
                className="grid-collapse"
                data-open={running !== undefined}
                inert={running === undefined}
            >
                <div>
                    {running !== undefined && (
                        <div className="flex items-center gap-2 border-b border-border bg-sidebar px-3 py-1.5 text-small">
                            {running.warn === true ? (
                                <span
                                    aria-hidden="true"
                                    className="size-1.5 shrink-0 rounded-full bg-warning"
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className="live-dot shrink-0"
                                />
                            )}
                            <span className="min-w-0 flex-1 truncate text-foreground">
                                {running.stepLabel}
                            </span>
                            {elapsed !== undefined && (
                                <span className="shrink-0 text-caption text-subtle-foreground tabular-nums">
                                    {formatDuration(elapsed, true)}
                                </span>
                            )}
                            <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                onClick={running.onStop}
                            >
                                {running.stopLabel}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            <textarea
                value={value}
                onChange={(event) => onChange(event.currentTarget.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                aria-label={placeholder}
                disabled={disabled}
                rows={2}
                className="block max-h-48 min-h-14 w-full resize-none bg-transparent px-3.5 pt-3 pb-2 text-reading text-foreground outline-none placeholder:text-subtle-foreground disabled:opacity-50"
            />
            <div
                data-slot="composer-foot"
                className="flex items-center justify-between gap-2 px-3 pb-2.5"
            >
                <div className="flex min-w-0 items-center gap-1">
                    {footerStart}
                </div>
                <Button
                    type="button"
                    size="sm"
                    disabled={!sendAllowed || onSubmit === undefined}
                    {...(onSubmit === undefined ? {} : { onClick: onSubmit })}
                >
                    <CornerDownLeftIcon aria-hidden="true" />
                    <span>{sendLabel}</span>
                </Button>
            </div>
        </div>
    );
}
