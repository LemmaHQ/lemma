import { type StoredCodec, useStoredValue } from "@/features/preferences";

const SIDEBAR_CODEC: StoredCodec<boolean> = {
    parse: (raw) => raw !== "1",
    serialize: (open) => (open ? "0" : "1"),
};

/** The sidebar's open state, persisted in `localStorage`. */
export function useStoredSidebar() {
    const [open, storeOpen] = useStoredValue(
        "lemma.sidebarCollapsed",
        SIDEBAR_CODEC,
    );
    return { open, storeOpen };
}
