import { useEffect } from "react";

import { useProviderStore } from "./store";

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
