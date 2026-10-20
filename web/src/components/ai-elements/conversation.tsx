import { IconArrowDown } from "@tabler/icons-react";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import { type ComponentProps, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type ConversationProps = Omit<
    ComponentProps<typeof StickToBottom>,
    "initial" | "resize" | "instance"
>;

/**
 * Message log that follows new content while the reader is at the bottom and
 * stops following once the reader scrolls up.
 */
export function Conversation({ className, ...props }: ConversationProps) {
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

export function ConversationContent({
    className,
    ...props
}: Omit<ComponentProps<"div">, "ref">) {
    const { scrollRef, contentRef } = useStickToBottomContext();
    return (
        <ScrollArea className="min-h-0 flex-1" viewportRef={scrollRef}>
            <div ref={contentRef} className={className} {...props} />
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
 * Scrolls the enclosing `Conversation` to its end each time `trigger` changes
 * after mount, even when the reader has scrolled up.
 */
export function ConversationFollow({ trigger }: { trigger: string | null }) {
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

export function ConversationScrollButton({
    className,
}: {
    className?: string;
}) {
    const { t } = useTranslation();
    const { isAtBottom } = useStickToBottomContext();
    const scrollToEnd = useScrollToEnd();
    if (isAtBottom) {
        return null;
    }
    const label = t("chat.scrollToBottom");
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
                <IconArrowDown />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
