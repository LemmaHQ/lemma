import { AnimateIcon } from "@animate-ui/react/icons";
import * as React from "react";

import { useIsMobile } from "#hooks/use-mobile";
import {
    SidebarContext,
    useSidebar,
    type SidebarState,
} from "#hooks/use-sidebar";
import { PanelLeftIcon } from "#icons/panel-left";
import { cn } from "#lib/cn";
import { isShortcutIgnored } from "#lib/shortcut";
import { Button } from "#primitives/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "#primitives/sheet";

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

export {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
};
