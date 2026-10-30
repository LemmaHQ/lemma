/** Static facts a route declares in its `handle`. */
export interface RouteHandle {
    titleBar?: "sidebar" | "background";
    pinnedSidebar?: true;
}

/** The facts the matched routes declare in `handles`, ordered root first; a deeper route overrides a shallower one. */
export function mergeRouteHandles(handles: readonly unknown[]): RouteHandle {
    const merged: RouteHandle = {};
    for (const handle of handles) {
        if (typeof handle !== "object" || handle === null) {
            continue;
        }
        const titleBar = "titleBar" in handle ? handle.titleBar : undefined;
        if (titleBar === "sidebar" || titleBar === "background") {
            merged.titleBar = titleBar;
        }
        if ("pinnedSidebar" in handle && handle.pinnedSidebar === true) {
            merged.pinnedSidebar = true;
        }
    }
    return merged;
}
