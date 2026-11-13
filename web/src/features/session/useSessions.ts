import { useEffect } from "react";

import { useSessionStore } from "./store";

export function refreshSessions(): Promise<void> {
    return useSessionStore.getState().refresh();
}

/** Creates an empty session, optionally bound to `directory`, and returns its id. */
export function createSession(directory?: string): Promise<string> {
    return useSessionStore.getState().create(directory);
}

export function useSessions() {
    const store = useSessionStore();
    const loaded = useSessionStore((s) => s.loaded);
    const refresh = useSessionStore((s) => s.refresh);
    useEffect(() => {
        if (!loaded) {
            void refresh();
        }
    }, [loaded, refresh]);
    return store;
}
