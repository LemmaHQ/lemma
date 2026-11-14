import { useEffect } from "react";
import { type StoreApi, useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

export interface LoadedHook<S> {
    (): S;
    <T>(selector: (state: S) => T): T;
}

/** Builds a feature data hook that triggers `refresh()` when `!loaded` and subscribes with shallow equality. */
export function createLoadedHook<
    S extends { loaded: boolean; refresh: () => Promise<void> },
>(store: StoreApi<S>): LoadedHook<S> {
    function useLoaded(): S;
    function useLoaded<T>(selector: (state: S) => T): T;
    function useLoaded<T>(selector?: (state: S) => T): S | T {
        const loaded = useStore(store, (state) => state.loaded);
        const refresh = useStore(store, (state) => state.refresh);
        useEffect(() => {
            if (!loaded) {
                void refresh();
            }
        }, [loaded, refresh]);
        return useStore(
            store,
            useShallow((state: S): S | T =>
                selector === undefined ? state : selector(state),
            ),
        );
    }
    return useLoaded;
}
