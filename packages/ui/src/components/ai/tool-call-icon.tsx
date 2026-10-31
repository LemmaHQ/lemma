import { cn } from "cn";
import { WrenchIcon } from "lucide-react";

import { CircleAlertIcon } from "#icons/circle-alert";

export function ToolIcon({
    small = false,
    className,
}: {
    small?: boolean;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "grid flex-none place-items-center rounded-lg border bg-muted text-foreground [&_svg]:size-3.5",
                small ? "size-6 [&_svg]:size-3" : "size-6.5",
                className,
            )}
            aria-hidden="true"
        >
            <WrenchIcon />
        </span>
    );
}

export function ToolCallStatusIcon({
    status,
}: {
    status: "running" | "success" | "error";
}) {
    if (status === "running") {
        return (
            <svg
                className="size-3.5 animate-spin-loop fill-none [stroke-linecap:round]"
                viewBox="0 0 16 16"
                aria-hidden="true"
            >
                <circle
                    className="stroke-current stroke-[1.6] opacity-22"
                    cx="8"
                    cy="8"
                    r="5.75"
                />
                <path
                    className="stroke-foreground stroke-[1.6]"
                    d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75"
                />
            </svg>
        );
    }
    if (status === "error") {
        return <CircleAlertIcon className="size-3.5" />;
    }
    return (
        <svg
            className="size-3.5 fill-none stroke-current stroke-[1.8] text-foreground [stroke-linecap:round] [stroke-linejoin:round]"
            viewBox="0 0 16 16"
            aria-hidden="true"
        >
            <path
                className="animate-draw"
                d="M3.5 8.4 6.6 11.3 12.5 4.9"
                pathLength={1}
            />
        </svg>
    );
}
