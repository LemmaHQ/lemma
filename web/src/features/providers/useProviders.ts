import { useEffect } from "react";

import { useProvidersStore } from "./store";

/** Drops the loaded providers; the next `useProviders` mount loads them again. */
export function clearProviders(): void {
    useProvidersStore.setState(useProvidersStore.getInitialState());
}

export function useProviders() {
    const store = useProvidersStore();
    const loaded = useProvidersStore((s) => s.loaded);
    const refresh = useProvidersStore((s) => s.refresh);
    useEffect(() => {
        if (!loaded) {
            void refresh();
        }
    }, [loaded, refresh]);
    return store;
}
