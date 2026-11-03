import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import { type ComponentProps, useCallback, useEffect, useRef } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { Button } from "#primitives/button";
import { ScrollArea } from "#primitives/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "#primitives/tooltip";
import { ArrowDownIcon } from "#icons/arrow-down";

type SessionProps = Omit<
    ComponentProps<typeof StickToBottom>,
    "initial" | "resize" | "instance"
>;

/**
 * Message log that follows new content while the reader is at the bottom and
 * stops following once the reader scrolls up.
 */
export function Session({ className, ...props }: SessionProps) {
    const reduceMotion = useReducedMotion();
    return (
        <StickToBottom
            className={cn("relative flex min-h-0 flex-1 flex-col", className)}
            initial="instant"
            resize={reduceMotion === true ? "instant" : "smooth"}
            role="log"
            {...props}
        />
    );
}

export function SessionContent({
    className,
    ...props
}: Omit<ComponentProps<"div">, "ref">) {
    const { scrollRef, contentRef } = useStickToBottomContext();
    return (
        <ScrollArea className="min-h-0 flex-1" viewportRef={scrollRef}>
            <div
                ref={contentRef}
                className={cn(
                    "mx-auto w-full max-w-3xl space-y-8 px-6 pt-4 pb-6",
                    className,
                )}
                {...props}
            />
        </ScrollArea>
    );
}

function useScrollToEnd() {
    const { scrollToBottom } = useStickToBottomContext();
    const reduceMotion = useReducedMotion();
    return useCallback(
        () => scrollToBottom(reduceMotion === true ? "instant" : "smooth"),
        [scrollToBottom, reduceMotion],
    );
}

/**
 * Scrolls the enclosing `Session` to its end each time `trigger` changes
 * after mount, even when the reader has scrolled up.
 */
export function SessionFollow({ trigger }: { trigger: string | null }) {
    const scrollToEnd = useScrollToEnd();
    const followed = useRef(trigger);
    useEffect(() => {
        if (trigger !== followed.current) {
            followed.current = trigger;
            void scrollToEnd();
        }
    }, [trigger, scrollToEnd]);
    return null;
}

export function SessionScrollButton({
    label,
    className,
}: {
    label: string;
    className?: string;
}) {
    const { isAtBottom } = useStickToBottomContext();
    const scrollToEnd = useScrollToEnd();
    if (isAtBottom) {
        return null;
    }
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        aria-label={label}
                        className={cn(
                            "absolute bottom-4 left-1/2 -translate-x-1/2 animate-in rounded-full bg-popover shadow-overlay duration-base ease-enter fade-in-0 zoom-in-95 hover:bg-accent",
                            className,
                        )}
                        onClick={() => {
                            void scrollToEnd();
                        }}
                        size="icon-sm"
                        type="button"
                        variant="outline"
                    />
                }
            >
                <ArrowDownIcon />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
