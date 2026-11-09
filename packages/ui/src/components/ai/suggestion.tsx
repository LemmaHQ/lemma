import { cn } from "#lib/cn";
import type { ComponentProps } from "react";

import { Button } from "#primitives/button";

type SuggestionProps = Omit<
    ComponentProps<typeof Button>,
    "onClick" | "children"
> & {
    suggestion: string;
    onClick: (suggestion: string) => void;
};

export function Suggestion({
    suggestion,
    onClick,
    className,
    ...props
}: SuggestionProps) {
    return (
        <Button
            className={cn(
                "h-8 cursor-pointer rounded-full px-3 text-small",
                className,
            )}
            onClick={() => onClick(suggestion)}
            size="default"
            type="button"
            variant="outline"
            {...props}
        >
            {suggestion}
        </Button>
    );
}
