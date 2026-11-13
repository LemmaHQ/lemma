import { useEffect } from "react";

import { useWebProviderStore } from "./store";

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
