import { useState } from "react";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

/** The sidebar's open state, persisted in `localStorage`. */
export function useStoredSidebar() {
    const [open, setOpen] = useState(
        () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== "1",
    );

    return {
        open,
        storeOpen: (next: boolean) => {
            setOpen(next);
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "0" : "1");
        },
    };
}
