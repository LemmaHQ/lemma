import { useEffect } from "react";

import { useSessionStore } from "./store";

export function refreshSessions(): Promise<void> {
    return useSessionStore.getState().refresh();
}

/** Creates an empty session and returns its id. */
export function createSession(): Promise<string> {
    return useSessionStore.getState().create();
}

/** Drops the loaded session list; the next `useSessions` mount or `refreshSessions` call loads it again. */
export function clearSessions(): void {
    useSessionStore.setState(useSessionStore.getInitialState());
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
