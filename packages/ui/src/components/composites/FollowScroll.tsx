import { ArrowDownIcon } from "#icons/arrow-down";
import { cn } from "#lib/cn";
import { Button } from "#primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#primitives/tooltip";
import { useReducedMotion } from "motion/react";
import {
    type ReactNode,
    type UIEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { FollowScrollContext } from "./useFollowScroll";

type FollowScrollProps = {
    followTrigger: unknown;
    scrollToBottomLabel: string;
    overlay?: ReactNode;
    children: ReactNode;
};

function FollowScrollContent({
    followTrigger,
    scrollToBottomLabel,
    overlay,
    children,
}: FollowScrollProps) {
    const { scrollRef, contentRef, isAtBottom, scrollToBottom } =
        useStickToBottomContext();
    const behavior = useReducedMotion() === true ? "instant" : "smooth";
    const [stuck, setStuck] = useState(false);
    const followedRef = useRef(followTrigger);

    const scrollToEnd = useCallback(
        () => scrollToBottom(behavior),
        [behavior, scrollToBottom],
    );

    useEffect(() => {
        if (followTrigger !== followedRef.current) {
            followedRef.current = followTrigger;
            void scrollToEnd();
        }
    }, [followTrigger, scrollToEnd]);

    const scroll = useMemo(
        () => ({
            scrollIntoView: (selector: string) => {
                scrollRef.current
                    ?.querySelector<HTMLElement>(selector)
                    ?.scrollIntoView({ behavior, block: "start" });
            },
        }),
        [behavior, scrollRef],
    );

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
        const container = event.currentTarget;
        const containerTop = container.getBoundingClientRect().top;
        const stickies = container.querySelectorAll<HTMLElement>(
            "[data-follow-sticky]",
        );
        setStuck(
            container.scrollTop > 0 &&
                Array.from(stickies).some(
                    (sticky) =>
                        sticky.getBoundingClientRect().top <= containerTop + 12,
                ),
        );
    };

    return (
        <FollowScrollContext value={scroll}>
            <div
                ref={scrollRef}
                data-slot="follow-scroll"
                onScroll={handleScroll}
                className="min-h-0 flex-1 overflow-y-auto"
            >
                <div
                    aria-hidden="true"
                    data-slot="follow-scroll-shade"
                    data-stuck={stuck ? "" : undefined}
                    className={cn(
                        "pointer-events-none sticky top-0 z-20 -mb-8 h-8 bg-linear-to-b from-background to-transparent transition-opacity duration-base",
                        stuck ? "opacity-100" : "opacity-0",
                    )}
                />
                <div ref={contentRef}>{children}</div>
            </div>
            {!isAtBottom && (
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={scrollToBottomLabel}
                                onClick={() => {
                                    void scrollToEnd();
                                }}
                                className="fade-in-0 zoom-in-95 animate-in absolute bottom-4 left-1/2 z-20 size-8 -translate-x-1/2 rounded-full border bg-popover shadow-overlay duration-base ease-enter hover:bg-accent"
                            />
                        }
                    >
                        <ArrowDownIcon />
                    </TooltipTrigger>
                    <TooltipContent>{scrollToBottomLabel}</TooltipContent>
                </Tooltip>
            )}
            {overlay}
        </FollowScrollContext>
    );
}

/**
 * A live log that keeps its end in view as content grows and scrolls to the end whenever `followTrigger` changes.
 * Away from the end it offers a scroll-to-bottom button, and a shade fades in once a `data-follow-sticky`
 * descendant sticks to the top. `overlay` renders over the log; it and `children` reach `useFollowScroll`.
 */
export function FollowScroll(props: FollowScrollProps) {
    const reduceMotion = useReducedMotion();

    return (
        <StickToBottom
            initial="instant"
            resize={reduceMotion === true ? "instant" : "smooth"}
            role="log"
            aria-live="polite"
            className="relative flex min-h-0 flex-1 flex-col"
        >
            <FollowScrollContent {...props} />
        </StickToBottom>
    );
}
