import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { LoaderCircleIcon } from "#icons/loader-circle";
import { cn } from "#lib/cn";

const buttonVariants = cva(
    "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 not-aria-[haspopup]:active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive-border aria-invalid:ring-3 aria-invalid:ring-destructive-ring [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground hover:bg-primary-hover",
                outline:
                    "border-input bg-control hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:bg-secondary-hover",
                ghost: "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
                row: "w-full justify-start font-normal text-foreground hover:bg-accent data-active:bg-selected data-active:font-medium",
                destructive:
                    "bg-destructive-subtle text-destructive hover:bg-destructive-subtle-hover focus-visible:border-destructive-border focus-visible:ring-destructive-ring",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default:
                    "h-8 gap-1.5 px-2.5 text-body has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
                xs: "h-6 gap-1 rounded-sm px-2 text-caption has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
                sm: "h-7 gap-1 px-2.5 text-small has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
                lg: "h-9 gap-1.5 px-3 text-body has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
                icon: "size-8",
                "icon-xs":
                    "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
                "icon-sm": "size-7",
                "icon-lg": "size-9",
            },
            tone: {
                default: "",
                success: "border-success text-success",
                destructive: "border-destructive-border text-destructive",
            },
        },
        compoundVariants: [
            {
                variant: "row",
                size: "default",
                class: "px-2 text-small has-data-[icon=inline-start]:pl-2",
            },
        ],
        defaultVariants: {
            variant: "default",
            size: "default",
            tone: "default",
        },
    },
);

/** `loading` disables the button and shows a spinner before its content; `tone` colors the border and text to report an outcome. The `row` variant draws a list row and marks the current row through `data-active`. */
function Button({
    className,
    variant = "default",
    size = "default",
    tone = "default",
    loading = false,
    disabled,
    children,
    ...props
}: ButtonPrimitive.Props &
    VariantProps<typeof buttonVariants> & { loading?: boolean }) {
    return (
        <ButtonPrimitive
            data-slot="button"
            className={cn(buttonVariants({ variant, size, tone }), className)}
            disabled={disabled === true || loading}
            aria-busy={loading || undefined}
            {...props}
        >
            {loading && <LoaderCircleIcon animate />}
            {children}
        </ButtonPrimitive>
    );
}

export { Button };
