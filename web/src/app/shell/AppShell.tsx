import {
    cn,
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
    SidebarRail,
    useSidebar,
} from "@lemma/ui";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useMatch } from "react-router";

import { AccountMenu } from "./AccountMenu";
import { BackHomeButton } from "./BackHomeButton";
import { NewConversationButton } from "./NewConversationButton";
import { ShellContext } from "./shell-context";
import { ShellToolbar } from "./ShellToolbar";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { useTitleBarSurface } from "./useTitleBarSurface";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "sidebar-width";

/**
 * The layout route of the signed-in pages: a resizable, collapsible sidebar beside the page, with a header across the page.
 * Pages fill the sidebar body through `ShellSidebar` and the header title through `useShellTitle`.
 * The settings pages keep the sidebar open on wide screens and show the way back home instead of the shell buttons and the account menu.
 */
export function AppShell() {
    const { t } = useTranslation();
    const settings = useMatch("/settings/*") !== null;
    const collapsible = !settings;
    const [open, setOpen] = useState(
        () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== "1",
    );
    const [width, setWidth] = useState<number | null>(() => {
        const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
        return stored > 0 ? stored : null;
    });
    const [sidebarTarget, setSidebarTarget] = useState<HTMLElement | null>(
        null,
    );
    const [title, setTitle] = useState<string | undefined>(undefined);
    const slots = useMemo(() => ({ sidebarTarget, setTitle }), [sidebarTarget]);

    useTitleBarSurface("sidebar");

    return (
        <ShellContext value={slots}>
            <div className="animate-in duration-slow ease-enter fade-in-0">
                <SidebarProvider
                    open={open || !collapsible}
                    onOpenChange={(next) => {
                        if (!collapsible) {
                            return;
                        }
                        setOpen(next);
                        localStorage.setItem(
                            SIDEBAR_COLLAPSED_KEY,
                            next ? "0" : "1",
                        );
                    }}
                    width={width}
                    onWidthChange={(next) => {
                        setWidth(next);
                        if (next === null) {
                            localStorage.removeItem(SIDEBAR_WIDTH_KEY);
                        } else {
                            localStorage.setItem(
                                SIDEBAR_WIDTH_KEY,
                                String(next),
                            );
                        }
                    }}
                    className="h-dvh"
                >
                    <Sidebar variant="inset" label={t("sidebar.title")}>
                        <SidebarHeader
                            className={cn(
                                "shell-transition-sidebar-header",
                                settings
                                    ? "view-transition-from-end"
                                    : "view-transition-from-start",
                            )}
                        >
                            {settings ? (
                                <BackHomeButton />
                            ) : (
                                <>
                                    <div className="flex h-8.5 items-center justify-between pl-1.5">
                                        <span className="font-sidebar-brand text-lg text-sidebar-foreground">
                                            {t("common.appName")}
                                        </span>
                                        <SidebarToggleButton />
                                    </div>
                                    <NewConversationButton />
                                </>
                            )}
                        </SidebarHeader>
                        <SidebarContent>
                            <div
                                ref={setSidebarTarget}
                                className={cn(
                                    "flex flex-col shell-transition-sidebar",
                                    settings
                                        ? "view-transition-from-end"
                                        : "view-transition-from-start",
                                )}
                            />
                        </SidebarContent>
                        {collapsible && (
                            <SidebarFooter className="shell-transition-sidebar-footer view-transition-fade">
                                <AccountMenu />
                            </SidebarFooter>
                        )}
                        <SidebarRail aria-label={t("sidebar.resize")} />
                    </Sidebar>
                    <SidebarInset className="overflow-hidden">
                        <ShellHeader collapsible={collapsible} title={title} />
                        <div className="flex min-h-0 flex-1 flex-col shell-transition-main view-transition-rise">
                            <Outlet />
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </div>
        </ShellContext>
    );
}

function ShellHeader({
    collapsible,
    title,
}: {
    collapsible: boolean;
    title: string | undefined;
}) {
    const { isMobile, open } = useSidebar();
    const revealed = isMobile || (collapsible && !open);

    return (
        <header
            data-revealed={revealed ? "" : undefined}
            data-titled={title === undefined ? undefined : ""}
            className={cn(
                "group/shell-header relative flex h-12 shrink-0 items-center gap-2 px-3 transition-all duration-sidebar ease-enter data-titled:border-b motion-reduce:transition-none",
                collapsible ? "data-revealed:pl-20" : "data-revealed:pl-12",
            )}
        >
            <div className="invisible absolute left-2 opacity-0 transition-sidebar-reveal-hide group-data-revealed/shell-header:visible group-data-revealed/shell-header:opacity-100 group-data-revealed/shell-header:transition-sidebar-reveal-show motion-reduce:transition-none">
                <ShellToolbar newConversation={collapsible} />
            </div>
            <div className="min-w-0 flex-1 truncate text-sm font-medium text-foreground shell-transition-title view-transition-fade">
                {title}
            </div>
        </header>
    );
}
