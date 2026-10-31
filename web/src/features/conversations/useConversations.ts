import { useEffect } from "react";

import { useConversationsStore } from "./store";

export function refreshConversations(): Promise<void> {
    return useConversationsStore.getState().refresh();
}

/** Creates an empty conversation and returns its id. */
export function createConversation(): Promise<string> {
    return useConversationsStore.getState().create();
}

/** Drops the loaded conversation list; the next `useConversations` mount or `refreshConversations` call loads it again. */
export function clearConversations(): void {
    useConversationsStore.setState(useConversationsStore.getInitialState());
}

export function useConversations() {
    const store = useConversationsStore();
    const loaded = useConversationsStore((s) => s.loaded);
    const refresh = useConversationsStore((s) => s.refresh);
    useEffect(() => {
        if (!loaded) {
            void refresh();
        }
    }, [loaded, refresh]);
    return store;
}
