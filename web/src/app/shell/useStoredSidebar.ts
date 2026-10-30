import { useState } from "react";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "sidebar-width";

/** The sidebar's open state and width, kept in `localStorage`; a `null` width is the default width. */
export function useStoredSidebar() {
    const [open, setOpen] = useState(
        () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== "1",
    );
    const [width, setWidth] = useState<number | null>(() => {
        const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
        return stored > 0 ? stored : null;
    });

    return {
        open,
        width,
        storeOpen: (next: boolean) => {
            setOpen(next);
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "0" : "1");
        },
        storeWidth: (next: number | null) => {
            setWidth(next);
            if (next === null) {
                localStorage.removeItem(SIDEBAR_WIDTH_KEY);
            } else {
                localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next));
            }
        },
    };
}
