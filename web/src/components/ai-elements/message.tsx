import { cn } from "cn";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type MessageProps = ComponentProps<"div"> & {
    from: "user" | "assistant";
};

export function Message({ className, from, ...props }: MessageProps) {
    return (
        <div
            className={cn(
                "group/message flex w-full max-w-[95%] flex-col gap-2 data-[from=user]:ml-auto data-[from=user]:justify-end",
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
                "flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-hidden text-sm text-foreground",
                "group-data-[from=user]/message:ml-auto group-data-[from=user]/message:rounded-lg group-data-[from=user]/message:bg-secondary group-data-[from=user]/message:px-4 group-data-[from=user]/message:py-3",
                className,
            )}
            {...props}
        />
    );
}

export function MessageActions({ className, ...props }: ComponentProps<"div">) {
    return (
        <div className={cn("flex items-center gap-1", className)} {...props} />
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

export const MessageResponse = memo(function MessageResponse({
    className,
    ...props
}: ComponentProps<typeof Streamdown>) {
    return (
        <Streamdown
            className={cn(
                "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                className,
            )}
            {...props}
        />
    );
});
