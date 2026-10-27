import { createContext } from "react";

/** What a page inside `AppShell` fills in: the sidebar body element it portals into, and the page title. */
export interface ShellSlots {
    sidebarTarget: HTMLElement | null;
    setTitle: (title: string | undefined) => void;
}

export const ShellContext = createContext<ShellSlots | null>(null);
