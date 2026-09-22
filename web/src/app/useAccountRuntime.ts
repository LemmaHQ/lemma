import { useEffect } from "react";

import { closeDb, openDb } from "@/data/cache/database";
import { onSynced, startSync, stopSync } from "@/data/sync/engine";
import { useChat } from "@/features/agent/store";
import { useAuth } from "@/features/auth/store";
import { useConversationsStore } from "@/features/conversations/store";

export function useAccountRuntime() {
    const bootstrap = useAuth((s) => s.bootstrap);

    useEffect(() => {
        void bootstrap();
    }, [bootstrap]);

    const userId = useAuth((s) => s.user?.id ?? null);

    useEffect(() => {
        if (!userId) return;
        // Wire the sync stack to the signed-in user: open their per-user
        // cache, render it, re-render after every pull, and keep the watch
        // loop alive until logout or an account switch tears it down.
        openDb(userId);
        void useConversationsStore.getState().hydrateFromCache();
        const off = onSynced(() => {
            void useConversationsStore.getState().hydrateFromCache();
            void useChat.getState().syncFromCache();
        });
        startSync();
        return () => {
            off();
            stopSync();
            closeDb();
        };
    }, [userId]);
}
