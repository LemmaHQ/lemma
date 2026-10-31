import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { AnimateIcon } from "@animate-ui/react/icons";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

import { Button } from "#primitives/button";
import { Input } from "#primitives/input";
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
    width,
    onWidthChange: setWidth,
    className,
    style,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    width: number | null;
    onWidthChange: (width: number | null) => void;
}) {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);
    const [resizing, setResizing] = React.useState(false);

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
                event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
                (event.metaKey || event.ctrlKey)
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
            width,
            setWidth,
            resizing,
            setResizing,
        }),
        [
            state,
            open,
            setOpen,
            isMobile,
            openMobile,
            toggleSidebar,
            width,
            setWidth,
            resizing,
        ],
    );

    return (
        <SidebarContext.Provider value={contextValue}>
            <div
                data-slot="sidebar-wrapper"
                data-resizing={resizing ? "" : undefined}
                style={{
                    "--sidebar-width":
                        width === null
                            ? "var(--sidebar-width-default)"
                            : `${width}px`,
                    ...style,
                }}
                className={cn(
                    "group/sidebar-wrapper flex w-full has-data-[variant=inset]:bg-sidebar data-resizing:cursor-col-resize data-resizing:select-none",
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
            data-variant="inset"
            data-side="left"
            data-slot="sidebar"
        >
            <div
                data-slot="sidebar-gap"
                className="relative w-(--sidebar-width) bg-transparent transition-[width] duration-sidebar ease-enter group-data-[collapsible=offcanvas]:w-0 group-data-resizing/sidebar-wrapper:transition-none motion-reduce:transition-none"
            />
            <div
                data-slot="sidebar-container"
                data-side="left"
                className={cn(
                    "fixed top-(--sidebar-inset-top) bottom-0 left-0 z-10 hidden w-(--sidebar-width) p-2 [transition:var(--sidebar-show)] group-data-[collapsible=offcanvas]:invisible group-data-[collapsible=offcanvas]:-translate-x-4 group-data-[collapsible=offcanvas]:opacity-0 group-data-[collapsible=offcanvas]:[transition:var(--sidebar-hide)] group-data-resizing/sidebar-wrapper:transition-none motion-reduce:transition-none md:flex",
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

const SIDEBAR_RESIZE_STEP = 16;

type SidebarBounds = {
    width: number;
    min: number;
    max: number;
};

function measureSidebar(element: HTMLElement): SidebarBounds {
    const container = element.closest<HTMLElement>(
        "[data-slot=sidebar-container]",
    );
    const style = getComputedStyle(element);
    return {
        width: container?.getBoundingClientRect().width ?? 0,
        min: Number(style.getPropertyValue("--sidebar-width-min")),
        max: Number(style.getPropertyValue("--sidebar-width-max")),
    };
}

/** Drag handle on the sidebar edge: drag or arrow keys resize, double-click restores the default width. */
function SidebarRail({
    className,
    ...props
}: React.ComponentProps<"div"> & { "aria-label": string }) {
    const { width, setWidth, setResizing } = useSidebar();
    const drag = React.useRef<(SidebarBounds & { startX: number }) | null>(
        null,
    );

    const endDrag = () => {
        drag.current = null;
        setResizing(false);
    };

    return (
        <div
            data-sidebar="rail"
            data-slot="sidebar-rail"
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={width ?? undefined}
            tabIndex={0}
            onPointerDown={(event) => {
                if (event.button !== 0) {
                    return;
                }
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                    ...measureSidebar(event.currentTarget),
                    startX: event.clientX,
                };
                setResizing(true);
            }}
            onPointerMove={(event) => {
                const current = drag.current;
                if (current === null) {
                    return;
                }
                const next = current.width + (event.clientX - current.startX);
                setWidth(
                    Math.round(
                        Math.min(current.max, Math.max(current.min, next)),
                    ),
                );
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => {
                setWidth(null);
            }}
            onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                    return;
                }
                event.preventDefault();
                const bounds = measureSidebar(event.currentTarget);
                const sign = event.key === "ArrowRight" ? 1 : -1;
                const next = bounds.width + sign * SIDEBAR_RESIZE_STEP;
                setWidth(
                    Math.round(
                        Math.min(bounds.max, Math.max(bounds.min, next)),
                    ),
                );
            }}
            className={cn(
                "absolute inset-y-2 z-20 hidden w-3 cursor-col-resize touch-none outline-hidden -right-3 after:absolute after:inset-y-0 after:inset-s-1/2 after:w-px after:bg-sidebar-rail after:opacity-0 after:transition-sidebar-rail-hide hover:after:opacity-100 hover:after:transition-sidebar-rail-show focus-visible:after:opacity-100 focus-visible:after:transition-sidebar-rail-hide group-data-resizing/sidebar-wrapper:after:opacity-100 sm:flex motion-reduce:after:transition-none ltr:-translate-x-1/2 rtl:-translate-x-1/2",
                className,
            )}
            {...props}
        />
    );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
    return (
        <main
            data-slot="sidebar-inset"
            className={cn(
                "relative flex w-full flex-1 flex-col bg-background transition-[margin] duration-sidebar ease-enter motion-reduce:transition-none md:m-2 md:ml-0 md:rounded-sidebar-inset md:border md:border-sidebar-border md:peer-data-[state=collapsed]:ml-2",
                className,
            )}
            {...props}
        />
    );
}

function SidebarInput({
    className,
    ...props
}: React.ComponentProps<typeof Input>) {
    return (
        <Input
            data-slot="sidebar-input"
            data-sidebar="input"
            className={cn("h-8 w-full bg-background shadow-none", className)}
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
                    "mt-2 flex h-7 shrink-0 items-center rounded-md px-1.5 text-xs text-sidebar-faint ring-sidebar-ring outline-hidden focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
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
            className={cn("w-full text-sm", className)}
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
                "flex w-full min-w-0 flex-col gap-0 text-sidebar-item",
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
    "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md px-1.5 text-left text-sidebar-text ring-sidebar-ring outline-hidden transition-[background-color,color] duration-base ease-move group-has-data-[sidebar=menu-action]/menu-item:pr-8 hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:ring-2 active:bg-sidebar-selected disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:bg-sidebar-hover data-active:bg-sidebar-selected data-active:font-medium data-active:text-sidebar-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-sidebar-muted data-active:[&_svg]:text-sidebar-foreground [&>span:last-child]:truncate",
    {
        variants: {
            variant: {
                default: "",
                strong: "font-medium text-sidebar-foreground",
                outline:
                    "rounded-lg bg-background text-sidebar-foreground shadow-sidebar-card hover:bg-background hover:shadow-sidebar-card-hover",
            },
            size: {
                default: "h-7.5",
                sm: "h-7 text-xs",
                lg: "h-8.5",
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
                    "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
                    showOnHover &&
                        "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0",
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
    SidebarInput,
    SidebarInset,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
};
