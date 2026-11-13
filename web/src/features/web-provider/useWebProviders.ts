import { useEffect } from "react";

import { useWebProviderStore } from "./store";

/** Drops the loaded web providers; the next settings mount loads them again. */
export function clearWebProviders(): void {
    useWebProviderStore.setState(useWebProviderStore.getInitialState());
}

export function useWebProviders() {
    const store = useWebProviderStore();
    const loaded = useWebProviderStore((state) => state.loaded);
    const refresh = useWebProviderStore((state) => state.refresh);
    useEffect(() => {
        if (!loaded) {
            void refresh();
        }
    }, [loaded, refresh]);
    return store;
}
