import { useStopwatch } from "#hooks/use-stopwatch";
import { CornerDownLeftIcon } from "#icons/corner-down-left";
import { cn } from "#lib/cn";
import { formatDuration } from "#lib/format-duration";
import { Button } from "#primitives/button";
import { AnimateIcon } from "@animate-ui/react/icons";
import {
    type KeyboardEvent,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from "react";

type ComposerRunningState = {
    stepLabel: string;
    startedAtMs?: number | undefined;
    warn?: boolean | undefined;
    stopLabel: string;
    onStop: () => void;
};

type ComposerBoxProps = {
    value: string;
    onChange: (value: string) => void;
    onSubmit?: (() => void) | undefined;
    placeholder: string;
    sendLabel: string;
    disabled?: boolean | undefined;
    canSend: boolean;
    focusTrigger?: number | undefined;
    dock?: ReactNode;
    footerStart?: ReactNode;
    running?: ComposerRunningState | undefined;
    className?: string | undefined;
};

/** 680px composer box with optional top dock, collapsible live status bar, auto-growing textarea, and footer actions. */
export function ComposerBox({
    value,
    onChange,
    onSubmit,
    placeholder,
    sendLabel,
    disabled = false,
    canSend,
    focusTrigger,
    dock,
    footerStart,
    running,
    className,
}: ComposerBoxProps) {
    const [isComposing, setIsComposing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const prevFocusTriggerRef = useRef(focusTrigger);
    const elapsed = useStopwatch(running?.startedAtMs);
    const sendAllowed = canSend && !disabled;

    useEffect(() => {
        if (
            focusTrigger !== undefined &&
            focusTrigger !== prevFocusTriggerRef.current
        ) {
            prevFocusTriggerRef.current = focusTrigger;
            textareaRef.current?.focus();
        }
    }, [focusTrigger]);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !isComposing &&
            !event.nativeEvent.isComposing
        ) {
            event.preventDefault();
            if (sendAllowed) {
                onSubmit?.();
            }
        }
    };

    return (
        <div
            data-slot="composer-box"
            className={cn(
                "w-full max-w-170 overflow-hidden rounded-lg border border-input bg-background shadow-raised transition-colors duration-base focus-within:border-foreground",
                className,
            )}
        >
            <div
                data-slot="composer-dock"
                className="grid-collapse"
                data-open={dock !== undefined}
                inert={dock === undefined}
            >
                <div>
                    {dock !== undefined && (
                        <div className="border-b border-border bg-sidebar px-3.5 py-2">
                            {dock}
                        </div>
                    )}
                </div>
            </div>
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
                ref={textareaRef}
                value={value}
                onChange={(event) => onChange(event.currentTarget.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder={placeholder}
                aria-label={placeholder}
                disabled={disabled}
                className="block field-sizing-content max-h-48 min-h-14 w-full resize-none bg-transparent px-3.5 pt-3 pb-1.5 text-reading text-foreground outline-none placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-2 px-2.5 pb-2">
                <div className="flex min-w-0 flex-1 items-center gap-1">
                    {footerStart}
                </div>
                <AnimateIcon animateOnHover asChild>
                    <Button
                        type="button"
                        size="icon-sm"
                        aria-label={sendLabel}
                        disabled={!sendAllowed}
                        onClick={() => onSubmit?.()}
                    >
                        <CornerDownLeftIcon />
                    </Button>
                </AnimateIcon>
            </div>
        </div>
    );
}
