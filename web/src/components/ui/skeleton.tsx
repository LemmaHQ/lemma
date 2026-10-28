import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const skeletonVariants = cva("motion-safe:animate-pulse", {
    variants: {
        shape: {
            block: "rounded-md",
            circle: "rounded-full",
        },
        surface: {
            default: "bg-muted",
            sidebar: "bg-sidebar-selected",
        },
    },
    defaultVariants: {
        shape: "block",
        surface: "default",
    },
});

function Skeleton({
    className,
    shape,
    surface,
    ...props
}: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
    return (
        <div
            data-slot="skeleton"
            className={cn(skeletonVariants({ shape, surface }), className)}
            {...props}
        />
    );
}

export { Skeleton };
