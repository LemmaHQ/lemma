import { SidebarProvider } from "@lemma/ui";
import { Navigate, Outlet } from "react-router";

import { useAuth } from "@/features/auth";

import { paths } from "../route-paths";
import { useRouteHandle } from "../useRouteHandle";
import { useStoredSidebar } from "./useStoredSidebar";

/**
 * The layout route of the signed-in pages; signed-out users go to sign-in.
 * It holds the sidebar state across the layouts below, which keep the sidebar open while a route declares `pinnedSidebar`.
 */
export function SignedInLayout() {
    const signedIn = useAuth((s) => s.user !== null);
    const pinned = useRouteHandle().pinnedSidebar === true;
    const sidebar = useStoredSidebar();

    if (!signedIn) {
        return <Navigate to={paths.signIn} replace />;
    }

    return (
        <div className="animate-in duration-slow ease-enter fade-in-0">
            <SidebarProvider
                open={sidebar.open || pinned}
                onOpenChange={(next) => {
                    if (!pinned) {
                        sidebar.storeOpen(next);
                    }
                }}
                width={sidebar.width}
                onWidthChange={sidebar.storeWidth}
                className="h-dvh"
            >
                <Outlet />
            </SidebarProvider>
        </div>
    );
}
