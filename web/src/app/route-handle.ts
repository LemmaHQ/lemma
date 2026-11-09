/** Static facts a route declares in its `handle`. */
export interface RouteHandle {
    pinnedSidebar?: true;
}

/** The facts the matched routes declare in `handles`: the sidebar is pinned when any of them pins it. */
export function mergeRouteHandles(handles: readonly unknown[]): RouteHandle {
    const pinnedSidebar = handles.some(
        (handle) =>
            typeof handle === "object" &&
            handle !== null &&
            "pinnedSidebar" in handle &&
            handle.pinnedSidebar === true,
    );
    return pinnedSidebar ? { pinnedSidebar } : {};
}
