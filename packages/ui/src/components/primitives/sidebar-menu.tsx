import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "#lib/cn";

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-group"
            data-sidebar="group"
            className={cn(
                "relative flex w-full min-w-0 flex-col p-2",
                className,
            )}
            {...props}
        />
    );
}

function SidebarGroupLabel({
    className,
    render,
    ...props
}: useRender.ComponentProps<"div"> & React.ComponentProps<"div">) {
    return useRender({
        defaultTagName: "div",
        props: mergeProps<"div">(
            {
                className: cn(
                    "mt-2 flex h-7 shrink-0 items-center rounded-md px-2 text-caption text-subtle-foreground ring-sidebar-ring outline-hidden focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
                    className,
                ),
            },
            props,
        ),
        render,
        state: {
            slot: "sidebar-group-label",
            sidebar: "group-label",
        },
    });
}

function SidebarGroupContent({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-group-content"
            data-sidebar="group-content"
            className={cn("w-full text-small", className)}
            {...props}
        />
    );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
    return (
        <ul
            data-slot="sidebar-menu"
            data-sidebar="menu"
            className={cn(
                "flex w-full min-w-0 flex-col gap-0 text-small",
                className,
            )}
            {...props}
        />
    );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
    return (
        <li
            data-slot="sidebar-menu-item"
            data-sidebar="menu-item"
            className={cn("group/menu-item relative", className)}
            {...props}
        />
    );
}

const sidebarMenuButtonVariants = cva(
    "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left text-small text-sidebar-foreground ring-sidebar-ring outline-hidden transition-[background-color,color] duration-base ease-move group-has-data-[sidebar=menu-action]/menu-item:pr-8 hover:bg-sidebar-accent focus-visible:ring-2 active:bg-selected disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:bg-sidebar-accent data-active:bg-selected data-active:font-medium [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-active:[&_svg]:text-sidebar-foreground [&>span:last-child]:truncate",
    {
        variants: {
            variant: {
                default: "",
                strong: "font-medium",
                outline:
                    "border border-input bg-control hover:bg-sidebar-accent",
            },
            size: {
                default: "h-8",
                sm: "h-7",
                lg: "h-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

function SidebarMenuButton({
    render,
    isActive = false,
    variant = "default",
    size = "default",
    className,
    ...props
}: useRender.ComponentProps<"button"> &
    React.ComponentProps<"button"> & {
        isActive?: boolean;
    } & VariantProps<typeof sidebarMenuButtonVariants>) {
    return useRender({
        defaultTagName: "button",
        props: mergeProps<"button">(
            {
                className: cn(
                    sidebarMenuButtonVariants({ variant, size }),
                    className,
                ),
            },
            props,
        ),
        render,
        state: {
            slot: "sidebar-menu-button",
            sidebar: "menu-button",
            size,
            active: isActive,
        },
    });
}

function SidebarMenuAction({
    className,
    render,
    showOnHover = false,
    ...props
}: useRender.ComponentProps<"button"> &
    React.ComponentProps<"button"> & {
        showOnHover?: boolean;
    }) {
    return useRender({
        defaultTagName: "button",
        props: mergeProps<"button">(
            {
                className: cn(
                    "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform peer-hover/menu-button:text-sidebar-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
                    showOnHover &&
                        "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-foreground aria-expanded:opacity-100 md:opacity-0",
                    className,
                ),
            },
            props,
        ),
        render,
        state: {
            slot: "sidebar-menu-action",
            sidebar: "menu-action",
        },
    });
}

export {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
};
