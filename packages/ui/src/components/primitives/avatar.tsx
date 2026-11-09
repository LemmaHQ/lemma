import * as React from "react";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "#lib/cn";

function Avatar({
    className,
    size = "default",
    ...props
}: AvatarPrimitive.Root.Props & {
    size?: "default" | "sm" | "lg";
}) {
    return (
        <AvatarPrimitive.Root
            data-slot="avatar"
            data-size={size}
            className={cn(
                // oxlint-disable-next-line tailwindcss/no-restricted-classes -- the edge blends toward the image and the blend mode, not a color, changes with the theme
                "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
                className,
            )}
            {...props}
        />
    );
}

function AvatarFallback({
    className,
    ...props
}: AvatarPrimitive.Fallback.Props) {
    return (
        <AvatarPrimitive.Fallback
            data-slot="avatar-fallback"
            className={cn(
                "flex size-full items-center justify-center rounded-full bg-muted text-body text-muted-foreground group-data-[size=sm]/avatar:text-caption",
                className,
            )}
            {...props}
        />
    );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="avatar-badge"
            className={cn(
                "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
                "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
                "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
                "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
                className,
            )}
            {...props}
        />
    );
}

export { Avatar, AvatarFallback, AvatarBadge };
