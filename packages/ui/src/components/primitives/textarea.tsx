import * as React from "react";
import { cn } from "#lib/cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-control px-2.5 py-2 text-reading transition-colors outline-none placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive-border aria-invalid:ring-3 aria-invalid:ring-destructive-ring md:text-body",
                className,
            )}
            {...props}
        />
    );
}

export { Textarea };
