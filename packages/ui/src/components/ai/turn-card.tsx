import { cn } from "#lib/cn";
import type { ReactNode } from "react";

type TurnCardProps = {
    turnId: string;
    question: ReactNode;
    timeLabel?: string | undefined;
    children?: ReactNode;
    className?: string | undefined;
};

/** Conversation turn with a sticky question banner and optional hover timestamp. */
export function TurnCard({
    turnId,
    question,
    timeLabel,
    children,
    className,
}: TurnCardProps) {
    return (
        <div
            data-slot="turn-card"
            data-turn-id={turnId}
            className={cn("group/turn flex flex-col", className)}
        >
            <div
                data-say-card=""
                className="sticky top-2.5 z-10 -mx-4 mb-3.5 flex items-baseline gap-4 rounded-lg bg-selected px-4 py-2.5 text-reading font-normal text-foreground"
            >
                <div className="min-w-0 flex-1 wrap-break-word">{question}</div>
                {timeLabel !== undefined && (
                    <time className="shrink-0 text-caption text-subtle-foreground tabular-nums opacity-0 transition-opacity duration-base group-focus-within/turn:opacity-100 group-hover/turn:opacity-100">
                        {timeLabel}
                    </time>
                )}
            </div>
            {children}
        </div>
    );
}
