import { SidebarProvider } from "@lemma/ui";
import { Outlet } from "react-router";

import { useRouteHandle } from "../useRouteHandle";
import { useStoredSidebar } from "./useStoredSidebar";

const NOOP = () => {};

/**
 * The root layout route of the app.
 * It holds the sidebar state across the layouts below, keeping the sidebar open while a route declares `pinnedSidebar`.
 */
export function AppLayout() {
    const pinned = useRouteHandle().pinnedSidebar === true;
    const sidebar = useStoredSidebar();

    return (
        <div className="animate-in duration-slow ease-enter fade-in-0">
            <SidebarProvider
                open={sidebar.open || pinned}
                onOpenChange={pinned ? NOOP : sidebar.storeOpen}
                className="h-dvh"
            >
                <Outlet />
            </SidebarProvider>
        </div>
    );
}
