import { useEffect } from "react";

import { closeDb, openDb } from "@/data/cache/database";
import { useAuth } from "@/features/auth/store";
import { useConversationsStore } from "@/features/conversations/store";

export function useAccountRuntime() {
    const bootstrap = useAuth((s) => s.bootstrap);

    useEffect(() => {
        void bootstrap();
    }, [bootstrap]);

    const userId = useAuth((s) => s.user?.id ?? null);

    useEffect(() => {
        if (!userId) {
            return;
        }
        openDb(userId);
        void useConversationsStore.getState().refresh();
        return () => {
            closeDb();
        };
    }, [userId]);
}
