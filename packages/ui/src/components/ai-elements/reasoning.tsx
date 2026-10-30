import { cn } from "cn";
import { BrainIcon } from "lucide-react";
import {
    type ComponentProps,
    createContext,
    memo,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Streamdown } from "streamdown";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "#components/collapsible";
import { Shimmer } from "#components/ai-elements/shimmer";
import { ThinkingStatusIcon } from "#components/ai-elements/thinking-loader";
import { ChevronDownIcon } from "#icons/chevron-down";
import { useStopwatch } from "#hooks/use-stopwatch";
import { formatDuration } from "../../lib/format-duration";

const AUTO_CLOSE_DELAY_MS = 1000;

type ReasoningState = {
    isStreaming: boolean;
    isOpen: boolean;
    startedAt?: number | undefined;
    finishedAt?: number | undefined;
};

const ReasoningContext = createContext<ReasoningState>({
    isStreaming: false,
    isOpen: false,
});

type ReasoningProps = Omit<
    ComponentProps<typeof Collapsible>,
    "open" | "onOpenChange" | "defaultOpen"
> & {
    isStreaming?: boolean;
    defaultOpen?: boolean;
    startedAt?: number | undefined;
    finishedAt?: number | undefined;
};

/**
 * Collapsible reasoning block. When opened by `defaultOpen`, it closes once,
 * one second after `isStreaming` turns false.
 */
export function Reasoning({
    className,
    isStreaming = false,
    defaultOpen = false,
    startedAt,
    finishedAt,
    children,
    ...props
}: ReasoningProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [hasAutoClosed, setHasAutoClosed] = useState(false);

    useEffect(() => {
        let timer: number | undefined;
        if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
            timer = window.setTimeout(() => {
                setIsOpen(false);
                setHasAutoClosed(true);
            }, AUTO_CLOSE_DELAY_MS);
        }
        return () => {
            window.clearTimeout(timer);
        };
    }, [defaultOpen, isStreaming, isOpen, hasAutoClosed]);

    const state = useMemo(
        () => ({ isStreaming, isOpen, startedAt, finishedAt }),
        [isStreaming, isOpen, startedAt, finishedAt],
    );

    return (
        <ReasoningContext value={state}>
            <Collapsible
                className={cn("mb-4", className)}
                onOpenChange={setIsOpen}
                open={isOpen}
                {...props}
            >
                {children}
            </Collapsible>
        </ReasoningContext>
    );
}

export function ReasoningTrigger({
    className,
    ...props
}: Omit<ComponentProps<typeof CollapsibleTrigger>, "children">) {
    const { t } = useTranslation("ui");
    const { isStreaming, isOpen, startedAt, finishedAt } =
        useContext(ReasoningContext);
    const elapsed = useStopwatch(startedAt, finishedAt);
    const hasDuration =
        elapsed !== undefined &&
        startedAt !== undefined &&
        finishedAt !== undefined;

    return (
        <CollapsibleTrigger
            className={cn(
                "flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                className,
            )}
            {...props}
        >
            {isStreaming || hasDuration ? (
                <ThinkingStatusIcon done={!isStreaming && hasDuration} />
            ) : (
                <BrainIcon className="size-4" aria-hidden="true" />
            )}
            {isStreaming ? (
                <>
                    <Shimmer>{t("agent.thinkingInProgress")}</Shimmer>
                    {elapsed !== undefined && (
                        <span className="reasoning-time">
                            {formatDuration(elapsed, true)}
                        </span>
                    )}
                </>
            ) : (
                <span>
                    {hasDuration
                        ? t("agent.thoughtFor", {
                              duration: formatDuration(elapsed),
                          })
                        : t("agent.thinking")}
                </span>
            )}
            <ChevronDownIcon
                className={cn(
                    "size-4 transition-transform duration-medium ease-move motion-reduce:transition-none",
                    isOpen && "rotate-180",
                )}
            />
        </CollapsibleTrigger>
    );
}

type ReasoningContentProps = Omit<
    ComponentProps<typeof CollapsibleContent>,
    "children"
> & {
    children: string;
};

export const ReasoningContent = memo(function ReasoningContent({
    className,
    children,
    ...props
}: ReasoningContentProps) {
    const { isOpen } = useContext(ReasoningContext);
    return (
        <CollapsibleContent
            className={cn(
                "grid-collapse text-sm text-muted-foreground outline-none",
                className,
            )}
            data-open={isOpen}
            keepMounted
            {...props}
        >
            <div>
                <div className="reasoning-body animate-blur-in">
                    <Streamdown>{children}</Streamdown>
                </div>
            </div>
        </CollapsibleContent>
    );
});
