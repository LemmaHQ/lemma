import { useEffect } from "react";

import { useProviderStore } from "./store";

/** Drops the loaded providers; the next `useProviders` mount loads them again. */
export function clearProviders(): void {
    useProviderStore.setState(useProviderStore.getInitialState());
}

export function useProviders() {
    const store = useProviderStore();
    const loaded = useProviderStore((s) => s.loaded);
    const refresh = useProviderStore((s) => s.refresh);
    useEffect(() => {
        if (!loaded) {
            void refresh();
        }
    }, [loaded, refresh]);
    return store;
}
