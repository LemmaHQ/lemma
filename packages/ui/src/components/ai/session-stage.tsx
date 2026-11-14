import { DrawerHeadingContext } from "#hooks/use-drawer-heading";
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
    useId,
    useRef,
    useState,
} from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

type SessionStageTurn = {
    id: string;
    label: string;
    ariaLabel?: string | undefined;
};

type SessionStageProps = {
    paned?: boolean | undefined;
    drawerId?: string | undefined;
    turns?: SessionStageTurn[] | undefined;
    rightPane?: ReactNode;
    onClosePane?: (() => void) | undefined;
    composer?: ReactNode;
    outlineLabel?: string | undefined;
    scrollToBottomLabel?: string | undefined;
    followTrigger?: string | null | undefined;
    children: ReactNode;
    className?: string | undefined;
};

function StageTranscript({
    followTrigger,
    scrollToBottomLabel,
    turns,
    paned,
    outlineLabel,
    children,
}: {
    followTrigger?: string | null | undefined;
    scrollToBottomLabel?: string | undefined;
    turns?: SessionStageTurn[] | undefined;
    paned: boolean;
    outlineLabel?: string | undefined;
    children: ReactNode;
}) {
    const { scrollRef, contentRef, isAtBottom, scrollToBottom } =
        useStickToBottomContext();
    const reduceMotion = useReducedMotion();
    const [stuck, setStuck] = useState(false);
    const followedRef = useRef(followTrigger);

    const scrollToEnd = useCallback(
        () => scrollToBottom(reduceMotion === true ? "instant" : "smooth"),
        [reduceMotion, scrollToBottom],
    );

    useEffect(() => {
        if (followTrigger !== followedRef.current) {
            followedRef.current = followTrigger;
            void scrollToEnd();
        }
    }, [followTrigger, scrollToEnd]);

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
        const container = event.currentTarget;
        const containerTop = container.getBoundingClientRect().top;
        const cards =
            container.querySelectorAll<HTMLElement>("[data-say-card]");
        const anyStuck =
            container.scrollTop > 0 &&
            Array.from(cards).some(
                (card) => card.getBoundingClientRect().top <= containerTop + 12,
            );
        setStuck(anyStuck);
    };

    const scrollToTurn = (turnId: string) => {
        const escaped = turnId.replaceAll('"', '\\"');
        const target = scrollRef.current?.querySelector<HTMLElement>(
            `[data-turn-id="${escaped}"]`,
        );
        target?.scrollIntoView({
            behavior: reduceMotion === true ? "instant" : "smooth",
            block: "start",
        });
    };

    return (
        <>
            <div
                ref={scrollRef}
                data-slot="session-stage-scroll"
                onScroll={handleScroll}
                className="min-h-0 flex-1 overflow-y-auto"
            >
                <div
                    aria-hidden="true"
                    data-slot="stage-shade"
                    data-stuck={stuck ? "" : undefined}
                    className={cn(
                        "pointer-events-none sticky top-0 z-20 -mb-8 h-8 bg-linear-to-b from-background to-transparent transition-opacity duration-base",
                        stuck ? "opacity-100" : "opacity-0",
                    )}
                />
                <div
                    ref={contentRef}
                    className="mx-auto w-full max-w-170 px-4 pt-6 pb-8 md:px-6"
                >
                    {children}
                </div>
            </div>

            {!isAtBottom && scrollToBottomLabel !== undefined && (
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

            {!paned && turns !== undefined && turns.length > 0 && (
                <nav
                    data-slot="turn-outline"
                    aria-label={outlineLabel}
                    className="pointer-events-none absolute top-1/2 right-3 z-20 hidden -translate-y-1/2 flex-col items-end gap-1.5 md:flex"
                >
                    {turns.map((turn) => (
                        <Tooltip key={turn.id}>
                            <TooltipTrigger
                                render={
                                    <button
                                        type="button"
                                        aria-label={
                                            turn.ariaLabel ?? turn.label
                                        }
                                        onClick={() => scrollToTurn(turn.id)}
                                        className="group pointer-events-auto flex cursor-pointer items-center gap-2 py-0.5 outline-none"
                                    />
                                }
                            >
                                <span className="h-0.5 w-3 rounded-full bg-input transition-all duration-base group-hover:w-5 group-hover:bg-foreground group-focus-visible:w-5 group-focus-visible:bg-foreground" />
                            </TooltipTrigger>
                            <TooltipContent side="left">
                                {turn.label}
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </nav>
            )}
        </>
    );
}

/**
 * Centered 680px reading stage with stick-to-bottom transcript following,
 * sticky-card scroll shade, right-edge turn outline ticks, bottom composer dock,
 * and a focus-managed 480px slide-in detail drawer.
 */
export function SessionStage({
    paned = false,
    drawerId,
    turns,
    rightPane,
    onClosePane,
    composer,
    outlineLabel,
    scrollToBottomLabel,
    followTrigger,
    children,
    className,
}: SessionStageProps) {
    const reduceMotion = useReducedMotion();
    const drawerHeadingId = useId();
    const drawerRef = useRef<HTMLElement>(null);
    const drawerOpen = paned && rightPane !== undefined;

    useEffect(() => {
        if (!drawerOpen) {
            return;
        }
        const restoreTarget = document.activeElement;
        drawerRef.current?.focus({ preventScroll: true });
        return () => {
            if (
                restoreTarget instanceof HTMLElement &&
                restoreTarget.isConnected
            ) {
                restoreTarget.focus({ preventScroll: true });
            }
        };
    }, [drawerOpen]);

    useEffect(() => {
        if (!drawerOpen || onClosePane === undefined) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !event.defaultPrevented) {
                event.stopPropagation();
                onClosePane();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [drawerOpen, onClosePane]);
    return (
        <div
            data-slot="session-stage"
            data-paned={paned ? "" : undefined}
            className={cn(
                "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background",
                className,
            )}
        >
            <div
                className={cn(
                    "flex min-h-0 flex-1 flex-col transition-[padding] duration-slow ease-enter motion-reduce:transition-none",
                    paned && "lg:pr-120",
                )}
            >
                <StickToBottom
                    initial="instant"
                    resize={reduceMotion === true ? "instant" : "smooth"}
                    role="log"
                    aria-live="polite"
                    className="relative flex min-h-0 flex-1 flex-col"
                >
                    <StageTranscript
                        followTrigger={followTrigger}
                        scrollToBottomLabel={scrollToBottomLabel}
                        turns={turns}
                        paned={paned}
                        outlineLabel={outlineLabel}
                    >
                        {children}
                    </StageTranscript>
                </StickToBottom>

                {composer !== undefined && (
                    <div className="shrink-0 px-4 pb-4 md:px-6">
                        <div className="mx-auto w-full max-w-170">
                            {composer}
                        </div>
                    </div>
                )}
            </div>

            {drawerOpen && (
                <>
                    <div
                        aria-hidden="true"
                        data-slot="drawer-scrim"
                        onClick={onClosePane}
                        className="fade-in-0 animate-in absolute inset-0 z-20 bg-scrim duration-base lg:hidden motion-reduce:animate-none"
                    />
                    <DrawerHeadingContext value={drawerHeadingId}>
                        <aside
                            id={drawerId}
                            ref={drawerRef}
                            tabIndex={-1}
                            aria-labelledby={drawerHeadingId}
                            data-slot="detail-drawer"
                            className="slide-in-from-right animate-in fade-in-0 absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-border bg-background shadow-overlay duration-slow ease-enter outline-none lg:w-120 motion-reduce:animate-none"
                        >
                            {rightPane}
                        </aside>
                    </DrawerHeadingContext>
                </>
            )}
        </div>
    );
}
