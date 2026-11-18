import { createContext, useContext } from "react";

type FollowScrollApi = { scrollIntoView: (selector: string) => void };

export const FollowScrollContext = createContext<FollowScrollApi | null>(null);

/**
 * `scrollIntoView` scrolls the first element inside the enclosing `FollowScroll` that matches `selector`
 * to the top, smoothly unless the user prefers reduced motion. Throws outside a `FollowScroll`.
 */
export function useFollowScroll(): FollowScrollApi {
    const api = useContext(FollowScrollContext);
    if (api === null) {
        throw new Error("useFollowScroll is called outside a FollowScroll");
    }
    return api;
}
