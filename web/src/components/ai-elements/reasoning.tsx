import { IconBrain, IconChevronDown } from "@tabler/icons-react";
import { cn } from "cn";
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
} from "@/components/ui/collapsible";

import { Shimmer } from "./shimmer";

const AUTO_CLOSE_DELAY_MS = 1000;

type ReasoningState = {
    isStreaming: boolean;
    isOpen: boolean;
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
};

/**
 * Collapsible reasoning block. When opened by `defaultOpen`, it closes once,
 * one second after `isStreaming` turns false.
 */
export function Reasoning({
    className,
    isStreaming = false,
    defaultOpen = false,
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
        () => ({ isStreaming, isOpen }),
        [isStreaming, isOpen],
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
    const { t } = useTranslation();
    const { isStreaming, isOpen } = useContext(ReasoningContext);
    return (
        <CollapsibleTrigger
            className={cn(
                "flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                className,
            )}
            {...props}
        >
            <IconBrain className="size-4" />
            {isStreaming ? (
                <Shimmer>{t("chat.thinkingInProgress")}</Shimmer>
            ) : (
                <span>{t("chat.thinking")}</span>
            )}
            <IconChevronDown
                className={cn(
                    "size-4 transition-transform",
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
    return (
        <CollapsibleContent
            className={cn(
                "mt-4 text-sm text-muted-foreground outline-none",
                className,
            )}
            {...props}
        >
            <Streamdown>{children}</Streamdown>
        </CollapsibleContent>
    );
});
