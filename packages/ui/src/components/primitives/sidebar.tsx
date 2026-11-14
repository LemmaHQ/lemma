import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { AnimateIcon } from "@animate-ui/react/icons";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "#lib/cn";
import { isShortcutIgnored } from "#lib/shortcut";
import { Button } from "#primitives/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "#primitives/sheet";
import { useIsMobile } from "#hooks/use-mobile";
import {
    SidebarContext,
    type SidebarState,
    useSidebar,
} from "#hooks/use-sidebar";
import { PanelLeftIcon } from "#icons/panel-left";

const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

function SidebarProvider({
    open,
    onOpenChange: setOpen,
    className,
    style,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);
    const toggleSidebar = React.useCallback(() => {
        if (isMobile) {
            setOpenMobile((current) => !current);
        } else {
            setOpen(!open);
        }
    }, [isMobile, open, setOpen]);

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                !isShortcutIgnored(event) &&
                event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT &&
                (event.metaKey || event.ctrlKey) &&
                !event.altKey &&
                !event.shiftKey
            ) {
                event.preventDefault();
                toggleSidebar();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleSidebar]);

    const state = open ? "expanded" : "collapsed";

    const contextValue = React.useMemo<SidebarState>(
        () => ({
            state,
            open,
            setOpen,
            isMobile,
            openMobile,
            setOpenMobile,
            toggleSidebar,
        }),
        [state, open, setOpen, isMobile, openMobile, toggleSidebar],
    );

    return (
        <SidebarContext.Provider value={contextValue}>
            <div
                data-slot="sidebar-wrapper"
                style={{
                    "--sidebar-width": "var(--sidebar-width-default)",
                    ...style,
                }}
                className={cn(
                    "group/sidebar-wrapper flex w-full has-data-[variant=inset]:bg-sidebar",
                    className,
                )}
                {...props}
            >
                {children}
            </div>
        </SidebarContext.Provider>
    );
}

/** `label` titles the sheet the sidebar becomes on mobile. */
function Sidebar({
    label,
    className,
    children,
    dir,
    ...props
}: React.ComponentProps<"div"> & {
    label: string;
}) {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

    if (isMobile) {
        return (
            <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
                <SheetContent
                    dir={dir}
                    data-sidebar="sidebar"
                    data-slot="sidebar"
                    data-mobile="true"
                    className="top-(--sidebar-inset-top) h-auto w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground"
                    style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE }}
                    side="left"
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>{label}</SheetTitle>
                    </SheetHeader>
                    <div className="flex size-full flex-col">{children}</div>
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <div
            className="group peer hidden text-sidebar-foreground md:block"
            data-state={state}
            data-collapsible={state === "collapsed" ? "offcanvas" : ""}
            data-variant="sidebar"
            data-side="left"
            data-slot="sidebar"
        >
            <div
                data-slot="sidebar-gap"
                className="relative w-(--sidebar-width) bg-transparent transition-[width] duration-reveal ease-enter group-data-[collapsible=offcanvas]:w-0 motion-reduce:transition-none"
            />
            <div
                data-slot="sidebar-container"
                data-side="left"
                className={cn(
                    "fixed top-(--sidebar-inset-top) bottom-0 left-0 z-10 hidden w-(--sidebar-width) border-r border-border [transition:var(--sidebar-show)] group-data-[collapsible=offcanvas]:invisible group-data-[collapsible=offcanvas]:-translate-x-4 group-data-[collapsible=offcanvas]:opacity-0 group-data-[collapsible=offcanvas]:[transition:var(--sidebar-hide)] motion-reduce:transition-none md:flex",
                    className,
                )}
                {...props}
            >
                <div
                    data-sidebar="sidebar"
                    data-slot="sidebar-inner"
                    className="flex size-full flex-col bg-sidebar"
                >
                    {children}
                </div>
            </div>
        </div>
    );
}

function SidebarTrigger({
    className,
    onClick,
    ...props
}: React.ComponentProps<typeof Button> & { "aria-label": string }) {
    const { toggleSidebar } = useSidebar();

    return (
        <AnimateIcon animateOnHover asChild>
            <Button
                data-sidebar="trigger"
                data-slot="sidebar-trigger"
                variant="ghost"
                size="icon-sm"
                className={cn(className)}
                onClick={(event) => {
                    onClick?.(event);
                    toggleSidebar();
                }}
                {...props}
            >
                <PanelLeftIcon />
            </Button>
        </AnimateIcon>
    );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
    return (
        <main
            data-slot="sidebar-inset"
            className={cn(
                "relative flex min-w-0 w-full flex-1 flex-col bg-background",
                className,
            )}
            {...props}
        />
    );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-header"
            data-sidebar="header"
            className={cn("flex flex-col gap-2 p-2", className)}
            {...props}
        />
    );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-footer"
            data-sidebar="footer"
            className={cn("flex flex-col gap-2 p-2", className)}
            {...props}
        />
    );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-content"
            data-sidebar="content"
            className={cn(
                "no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto",
                className,
            )}
            {...props}
        />
    );
}

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
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
};
