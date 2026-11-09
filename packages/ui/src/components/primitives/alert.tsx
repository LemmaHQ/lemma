import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "#lib/cn";

const alertVariants = cva(
    "group/alert relative grid w-full gap-0.5 rounded-md border px-3 py-2 text-left text-small has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default: "bg-card text-card-foreground",
                destructive:
                    "border-destructive-border bg-destructive-subtle text-destructive *:data-[slot=alert-description]:text-destructive",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

function Alert({
    className,
    variant,
    ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
    return (
        <div
            data-slot="alert"
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        />
    );
}

function AlertTitle({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-title"
            className={cn(
                "font-medium group-has-[>svg]/alert:col-start-2",
                className,
            )}
            {...props}
        />
    );
}

function AlertDescription({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-description"
            className={cn(
                "text-muted-foreground wrap-break-word group-has-[>svg]/alert:col-start-2",
                className,
            )}
            {...props}
        />
    );
}

export { Alert, AlertDescription, AlertTitle };
