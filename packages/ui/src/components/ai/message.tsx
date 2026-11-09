import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { cn } from "#lib/cn";
import { type ComponentProps, memo, useState } from "react";
import { Streamdown } from "streamdown";

import { Button } from "#primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#primitives/tooltip";
import { useCopyText } from "#hooks/use-copy-text";
import { CopyIcon } from "#icons/copy";
import { RefreshCwIcon } from "#icons/refresh-cw";

const PLUGINS = { code, cjk };
const RESPONSE_ANIMATION = {
    animation: "answerBlurIn",
    duration: 400,
    easing: "var(--motion-easing-enter)",
} as const;

type MessageProps = ComponentProps<"div"> & {
    from: "user" | "assistant";
};

/** An assistant message enters with a rising card animation. */
export function Message({ className, from, ...props }: MessageProps) {
    return (
        <div
            className={cn(
                "group/message flex w-full max-w-full flex-col gap-2 data-[from=user]:ml-auto data-[from=user]:justify-end",
                from === "assistant" && "animate-card-in",
                className,
            )}
            data-from={from}
            {...props}
        />
    );
}

export function MessageContent({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-hidden text-reading text-foreground",
                "group-data-[from=user]/message:ml-auto group-data-[from=user]/message:max-w-[80%] group-data-[from=user]/message:rounded-lg group-data-[from=user]/message:bg-muted group-data-[from=user]/message:px-4 group-data-[from=user]/message:py-2.5",
                className,
            )}
            {...props}
        />
    );
}

/** Action row that stays dimmed until the message is hovered or focused, except on touch screens. */
export function MessageActions({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "stagger-children flex items-center gap-1 text-caption text-subtle-foreground opacity-60 transition-opacity duration-medium ease-enter group-focus-within/message:opacity-100 group-hover/message:opacity-100 pointer-coarse:opacity-100 motion-reduce:opacity-100 motion-reduce:transition-none",
                className,
            )}
            {...props}
        />
    );
}

type MessageActionProps = ComponentProps<typeof Button> & {
    tooltip: string;
};

export function MessageAction({
    tooltip,
    variant = "ghost",
    size = "icon-sm",
    ...props
}: MessageActionProps) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        aria-label={tooltip}
                        size={size}
                        type="button"
                        variant={variant}
                        {...props}
                    />
                }
            />
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}

/** Copies `text`; the icon turns into a drawn check and the tooltip reads `copiedLabel` for a moment. */
export function MessageCopyAction({
    text,
    label,
    copiedLabel,
}: {
    text: string;
    label: string;
    copiedLabel: string;
}) {
    const { copied, copy } = useCopyText();
    return (
        <MessageAction
            tooltip={copied ? copiedLabel : label}
            onClick={() => copy(text)}
        >
            <span className="grid size-4 place-items-center" aria-hidden="true">
                <span
                    className="swap-layer grid place-items-center [grid-area:1/1]"
                    data-on={!copied}
                >
                    <CopyIcon />
                </span>
                <span
                    className="swap-layer grid place-items-center [grid-area:1/1]"
                    data-on={copied}
                >
                    <svg
                        className="fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
                        viewBox="0 0 24 24"
                    >
                        <path
                            key={copied ? "copied" : "copy"}
                            className="animate-draw"
                            d="m4 12 5 5L20 6"
                            pathLength={1}
                        />
                    </svg>
                </span>
            </span>
        </MessageAction>
    );
}

/** Calls `onRegenerate`; the icon spins once per click. */
export function MessageRegenerateAction({
    label,
    onRegenerate,
}: {
    label: string;
    onRegenerate: () => void;
}) {
    const [spins, setSpins] = useState(0);
    return (
        <MessageAction
            tooltip={label}
            onClick={() => {
                setSpins((count) => count + 1);
                onRegenerate();
            }}
        >
            <span
                key={spins}
                className={cn(
                    "grid place-items-center",
                    spins > 0 && "animate-spin-once",
                )}
            >
                <RefreshCwIcon />
            </span>
        </MessageAction>
    );
}

/** Markdown reply; while `isAnimating`, new text blurs in behind a pulsing caret. */
export const MessageResponse = memo(function MessageResponse({
    className,
    plugins = PLUGINS,
    caret = "circle",
    isAnimating = false,
    animated = isAnimating ? RESPONSE_ANIMATION : false,
    ...props
}: ComponentProps<typeof Streamdown>) {
    return (
        <Streamdown
            className={cn(
                "streaming-caret size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                className,
            )}
            animated={animated}
            caret={caret}
            isAnimating={isAnimating}
            plugins={plugins}
            {...props}
        />
    );
});
