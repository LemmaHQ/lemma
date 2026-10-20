import { cn } from "cn";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

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
            className={cn("cursor-pointer rounded-full px-4", className)}
            onClick={() => onClick(suggestion)}
            size="sm"
            type="button"
            variant="outline"
            {...props}
        >
            {suggestion}
        </Button>
    );
}
