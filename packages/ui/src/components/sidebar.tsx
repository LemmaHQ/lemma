import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { AnimateIcon } from "@animate-ui/react/icons";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { useTranslation } from "react-i18next";

import { Button } from "#components/button";
import { Input } from "#components/input";
import { Separator } from "#components/separator";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "#components/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "#components/tooltip";
import { useIsMobile } from "#hooks/use-mobile";
import {
    SidebarContext,
    type SidebarState,
    useSidebar,
} from "#hooks/use-sidebar";
import { PanelLeftIcon } from "#icons/panel-left";

const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

function SidebarProvider({
    defaultOpen = true,
    open: openProp,
    onOpenChange: setOpenProp,
    width: widthProp,
    onWidthChange: setWidthProp,
    className,
    style,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    width?: number | null;
    onWidthChange?: (width: number | null) => void;
}) {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);
    const [resizing, setResizing] = React.useState(false);

    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
    const open = openProp ?? uncontrolledOpen;
    const setOpen = React.useCallback(
        (value: boolean | ((value: boolean) => boolean)) => {
            const openState = typeof value === "function" ? value(open) : value;
            if (setOpenProp === undefined) {
                setUncontrolledOpen(openState);
            } else {
                setOpenProp(openState);
            }
        },
        [setOpenProp, open],
    );

    const [uncontrolledWidth, setUncontrolledWidth] = React.useState<
        number | null
    >(null);
    const width = widthProp === undefined ? uncontrolledWidth : widthProp;
    const setWidth = React.useCallback(
        (value: number | null) => {
            if (setWidthProp === undefined) {
                setUncontrolledWidth(value);
            } else {
                setWidthProp(value);
            }
        },
        [setWidthProp],
    );

    const toggleSidebar = React.useCallback(() => {
        if (isMobile) {
            setOpenMobile((current) => !current);
        } else {
            setOpen((current) => !current);
        }
    }, [isMobile, setOpen, setOpenMobile]);

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
            setOpenMobile,
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
                    "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
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

function Sidebar({
    side = "left",
    variant = "sidebar",
    collapsible = "offcanvas",
    className,
    children,
    dir,
    ...props
}: React.ComponentProps<"div"> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none";
}) {
    const { t } = useTranslation("ui");
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

    if (collapsible === "none") {
        return (
            <div
                data-slot="sidebar"
                className={cn(
                    "flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
                    className,
                )}
                {...props}
            >
                {children}
            </div>
        );
    }

    if (isMobile) {
        return (
            <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
                <SheetContent
                    dir={dir}
                    data-sidebar="sidebar"
                    data-slot="sidebar"
                    data-mobile="true"
                    className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground data-[side=left]:top-(--sidebar-inset-top) data-[side=left]:h-auto data-[side=right]:top-(--sidebar-inset-top) data-[side=right]:h-auto [&>button]:hidden"
                    style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE }}
                    side={side}
                >
                    <SheetHeader className="sr-only">
                        <SheetTitle>{t("sidebar.title")}</SheetTitle>
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
            data-collapsible={state === "collapsed" ? collapsible : ""}
            data-variant={variant}
            data-side={side}
            data-slot="sidebar"
        >
            <div
                data-slot="sidebar-gap"
                className={cn(
                    "relative w-(--sidebar-width) bg-transparent transition-[width] duration-sidebar ease-enter group-data-resizing/sidebar-wrapper:transition-none motion-reduce:transition-none",
                    "group-data-[collapsible=offcanvas]:w-0",
                    "group-data-[side=right]:rotate-180",
                    variant === "floating" || variant === "inset"
                        ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
                        : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
                )}
            />
            <div
                data-slot="sidebar-container"
                data-side={side}
                className={cn(
                    "fixed top-(--sidebar-inset-top) bottom-0 z-10 hidden w-(--sidebar-width) [transition:var(--sidebar-show)] data-[side=left]:left-0 data-[side=right]:right-0 group-data-[collapsible=offcanvas]:invisible group-data-[collapsible=offcanvas]:opacity-0 group-data-[collapsible=offcanvas]:[transition:var(--sidebar-hide)] group-data-[collapsible=offcanvas]:data-[side=left]:-translate-x-4 group-data-[collapsible=offcanvas]:data-[side=right]:translate-x-4 group-data-resizing/sidebar-wrapper:transition-none motion-reduce:transition-none md:flex",
                    variant === "floating" || variant === "inset"
                        ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
                        : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
                    className,
                )}
                {...props}
            >
                <div
                    data-sidebar="sidebar"
                    data-slot="sidebar-inner"
                    className="flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-raised group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
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
}: React.ComponentProps<typeof Button>) {
    const { t } = useTranslation("ui");
    const { toggleSidebar } = useSidebar();

    return (
        <AnimateIcon animateOnHover asChild>
            <Button
                data-sidebar="trigger"
                data-slot="sidebar-trigger"
                variant="ghost"
                size="icon-sm"
                aria-label={t("sidebar.toggle")}
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
    direction: 1 | -1;
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
        direction: container?.dataset["side"] === "right" ? -1 : 1,
    };
}

/** Drag handle on the sidebar edge: drag or arrow keys resize, double-click restores the default width. */
function SidebarRail({ className, ...props }: React.ComponentProps<"div">) {
    const { t } = useTranslation("ui");
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
            aria-label={t("sidebar.resize")}
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
                const next =
                    current.width +
                    (event.clientX - current.startX) * current.direction;
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
                const next =
                    bounds.width +
                    sign * bounds.direction * SIDEBAR_RESIZE_STEP;
                setWidth(
                    Math.round(
                        Math.min(bounds.max, Math.max(bounds.min, next)),
                    ),
                );
            }}
            className={cn(
                "absolute inset-y-2 z-20 hidden w-3 cursor-col-resize touch-none outline-hidden group-data-[side=left]:-right-3 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:inset-s-1/2 after:w-px after:bg-sidebar-rail after:opacity-0 after:transition-sidebar-rail-hide hover:after:opacity-100 hover:after:transition-sidebar-rail-show focus-visible:after:opacity-100 focus-visible:after:transition-sidebar-rail-hide group-data-resizing/sidebar-wrapper:after:opacity-100 sm:flex motion-reduce:after:transition-none ltr:-translate-x-1/2 rtl:-translate-x-1/2",
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
                "relative flex w-full flex-1 flex-col bg-background transition-[margin] duration-sidebar ease-enter motion-reduce:transition-none md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-sidebar-inset md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:border-sidebar-border md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
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

function SidebarSeparator({
    className,
    ...props
}: React.ComponentProps<typeof Separator>) {
    return (
        <Separator
            data-slot="sidebar-separator"
            data-sidebar="separator"
            className={cn("mx-2 w-auto bg-sidebar-border", className)}
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
                "no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
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
                    "mt-2 flex h-7 shrink-0 items-center rounded-md px-1.5 text-xs text-sidebar-faint ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-medium ease-move group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
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

function SidebarGroupAction({
    className,
    render,
    ...props
}: useRender.ComponentProps<"button"> & React.ComponentProps<"button">) {
    return useRender({
        defaultTagName: "button",
        props: mergeProps<"button">(
            {
                className: cn(
                    "absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
                    className,
                ),
            },
            props,
        ),
        render,
        state: {
            slot: "sidebar-group-action",
            sidebar: "group-action",
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
    "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md px-1.5 text-left text-sidebar-text ring-sidebar-ring outline-hidden transition-[background-color,color] duration-base ease-move group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:ring-2 active:bg-sidebar-selected disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:bg-sidebar-hover data-active:bg-sidebar-selected data-active:font-medium data-active:text-sidebar-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-sidebar-muted data-active:[&_svg]:text-sidebar-foreground [&>span:last-child]:truncate",
    {
        variants: {
            variant: {
                default: "",
                outline:
                    "rounded-lg bg-background text-sidebar-foreground shadow-sidebar-card hover:bg-background hover:shadow-sidebar-card-hover",
            },
            size: {
                default: "h-7.5",
                sm: "h-7 text-xs",
                lg: "h-8.5 group-data-[collapsible=icon]:p-0!",
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
    tooltip,
    className,
    ...props
}: useRender.ComponentProps<"button"> &
    React.ComponentProps<"button"> & {
        isActive?: boolean;
        tooltip?: string | React.ComponentProps<typeof TooltipContent>;
    } & VariantProps<typeof sidebarMenuButtonVariants>) {
    const { isMobile, state } = useSidebar();
    const comp = useRender({
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
        render:
            tooltip === undefined ? render : <TooltipTrigger render={render} />,
        state: {
            slot: "sidebar-menu-button",
            sidebar: "menu-button",
            size,
            active: isActive,
        },
    });

    if (tooltip === undefined) {
        return comp;
    }

    if (typeof tooltip === "string") {
        tooltip = {
            children: tooltip,
        };
    }

    return (
        <Tooltip>
            {comp}
            <TooltipContent
                side="right"
                align="center"
                hidden={state !== "collapsed" || isMobile}
                {...tooltip}
            />
        </Tooltip>
    );
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
                    "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
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

function SidebarMenuBadge({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sidebar-menu-badge"
            data-sidebar="menu-badge"
            className={cn(
                "pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 peer-data-active/menu-button:text-sidebar-accent-foreground",
                className,
            )}
            {...props}
        />
    );
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
    return (
        <ul
            data-slot="sidebar-menu-sub"
            data-sidebar="menu-sub"
            className={cn(
                "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden",
                className,
            )}
            {...props}
        />
    );
}

function SidebarMenuSubItem({
    className,
    ...props
}: React.ComponentProps<"li">) {
    return (
        <li
            data-slot="sidebar-menu-sub-item"
            data-sidebar="menu-sub-item"
            className={cn("group/menu-sub-item relative", className)}
            {...props}
        />
    );
}

function SidebarMenuSubButton({
    render,
    size = "md",
    isActive = false,
    className,
    ...props
}: useRender.ComponentProps<"a"> &
    React.ComponentProps<"a"> & {
        size?: "sm" | "md";
        isActive?: boolean;
    }) {
    return useRender({
        defaultTagName: "a",
        props: mergeProps<"a">(
            {
                className: cn(
                    "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground ring-sidebar-ring outline-hidden group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[size=md]:text-sm data-[size=sm]:text-xs data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
                    className,
                ),
            },
            props,
        ),
        render,
        state: {
            slot: "sidebar-menu-sub-button",
            sidebar: "menu-sub-button",
            size,
            active: isActive,
        },
    });
}

export {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInput,
    SidebarInset,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider,
    SidebarRail,
    SidebarSeparator,
    SidebarTrigger,
};
