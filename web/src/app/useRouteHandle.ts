import { useMatches } from "react-router";

import { mergeRouteHandles, type RouteHandle } from "./route-handle";

/** The facts the matched routes declare in their `handle`. */
export function useRouteHandle(): RouteHandle {
    return mergeRouteHandles(useMatches().map((match) => match.handle));
}
