import { cn } from "cn";
import { WrenchIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CircleAlertIcon } from "#icons/circle-alert";

export function ToolIcon({
    icon,
    small = false,
    className,
}: {
    icon?: ReactNode;
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
            {icon ?? <WrenchIcon />}
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
                className="tool-call-spinner size-3.5"
                viewBox="0 0 16 16"
                aria-hidden="true"
            >
                <circle cx="8" cy="8" r="5.75" />
                <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />
            </svg>
        );
    }
    if (status === "error") {
        return <CircleAlertIcon className="size-3.5" />;
    }
    return (
        <svg
            className="size-3.5 text-foreground"
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
