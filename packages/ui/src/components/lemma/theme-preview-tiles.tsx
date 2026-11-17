import { cn } from "#lib/cn";
import { type KeyboardEvent, useRef } from "react";

export type ThemeChoice = "light" | "dark" | "system";

type ThemePreviewTilesProps = {
    value: ThemeChoice;
    onValueChange: (value: ThemeChoice) => void;
    label: string;
    labels: Record<ThemeChoice, string>;
    className?: string;
};

const OPTIONS: readonly ThemeChoice[] = ["light", "dark", "system"];

function PreviewSurface({ theme }: { theme: "light" | "dark" }) {
    return (
        <div
            data-theme-preview={theme}
            className="flex size-full overflow-hidden bg-background text-foreground"
        >
            <div className="flex w-6 shrink-0 flex-col gap-1 border-r border-border bg-sidebar p-1.5">
                <span className="h-1 w-full rounded-full bg-brand" />
                <span className="h-1 w-3/4 rounded-full bg-muted-foreground/30" />
                <span className="h-1 w-4/5 rounded-full bg-muted-foreground/20" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-2">
                <span className="h-1.5 w-8 rounded-full bg-foreground/25" />
                <span className="h-1 w-full rounded-full bg-muted-foreground/25" />
                <span className="h-1 w-3/4 rounded-full bg-muted-foreground/20" />
            </div>
        </div>
    );
}

/** Three pure-CSS 92×58px theme preview radio tiles for light, dark, and system modes. */
export function ThemePreviewTiles({
    value,
    onValueChange,
    label,
    labels,
    className,
}: ThemePreviewTilesProps) {
    const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const selectIndex = (nextIndex: number) => {
        const next: ThemeChoice =
            nextIndex === 0 ? "light" : nextIndex === 1 ? "dark" : "system";
        onValueChange(next);
        buttonRefs.current[nextIndex]?.focus();
    };
    const handleKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        index: number,
    ) => {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            selectIndex((index + 1) % OPTIONS.length);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            selectIndex((index - 1 + OPTIONS.length) % OPTIONS.length);
        } else if (event.key === "Home") {
            event.preventDefault();
            selectIndex(0);
        } else if (event.key === "End") {
            event.preventDefault();
            selectIndex(OPTIONS.length - 1);
        }
    };

    return (
        <div
            data-slot="theme-preview-tiles"
            role="radiogroup"
            aria-label={label}
            className={cn("flex flex-wrap gap-3.5 sm:flex-nowrap", className)}
        >
            {OPTIONS.map((option, index) => {
                const active = value === option;
                return (
                    <button
                        key={option}
                        ref={(element) => {
                            buttonRefs.current[index] = element;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onValueChange(option)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                        className="group flex cursor-pointer flex-col items-start gap-1.5 text-left outline-none"
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                "relative flex h-14.5 w-23 overflow-hidden rounded-md transition-shadow duration-base group-focus-visible:ring-2 group-focus-visible:ring-ring",
                                active
                                    ? "ring-2 ring-foreground"
                                    : "ring-1 ring-input group-hover:ring-muted-foreground",
                            )}
                        >
                            {option === "system" ? (
                                <>
                                    <span className="h-full w-1/2 overflow-hidden">
                                        <PreviewSurface theme="light" />
                                    </span>
                                    <span className="h-full w-1/2 overflow-hidden border-l border-border">
                                        <PreviewSurface theme="dark" />
                                    </span>
                                </>
                            ) : (
                                <PreviewSurface theme={option} />
                            )}
                        </span>
                        <span
                            className={cn(
                                "text-small",
                                active
                                    ? "font-medium text-foreground"
                                    : "text-muted-foreground",
                            )}
                        >
                            {labels[option]}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
