import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void): () => void {
    const query = window.matchMedia(MOBILE_QUERY);
    query.addEventListener("change", onChange);
    return () => {
        query.removeEventListener("change", onChange);
    };
}

/** Whether the viewport is narrower than Tailwind's `md` breakpoint. */
export function useIsMobile(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(MOBILE_QUERY).matches,
    );
}
