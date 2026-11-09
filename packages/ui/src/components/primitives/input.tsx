import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "#lib/cn";
import * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <InputPrimitive
            type={type}
            data-slot="input"
            className={cn(
                "h-8 w-full min-w-0 rounded-md border border-input bg-control px-2.5 py-1 text-reading text-foreground transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-body file:font-medium file:text-foreground placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive-border aria-invalid:ring-3 aria-invalid:ring-destructive-ring md:text-body",
                className,
            )}
            {...props}
        />
    );
}

export { Input };
