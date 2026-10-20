import { createContext, useContext } from "react";

export type SidebarState = {
    state: "expanded" | "collapsed";
    open: boolean;
    setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
    openMobile: boolean;
    setOpenMobile: (open: boolean | ((open: boolean) => boolean)) => void;
    isMobile: boolean;
    toggleSidebar: () => void;
};

export const SidebarContext = createContext<SidebarState | null>(null);

/** The state of the enclosing `SidebarProvider`; throws outside one. */
export function useSidebar(): SidebarState {
    const context = useContext(SidebarContext);
    if (context === null) {
        throw new Error("useSidebar must be used within a SidebarProvider.");
    }
    return context;
}
