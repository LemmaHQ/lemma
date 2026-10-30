import { useEffect } from "react";

import { useAuth } from "@/features/auth";
import { refreshConversations } from "@/features/conversations";

export function useAccountRuntime() {
    const bootstrap = useAuth((s) => s.bootstrap);

    useEffect(() => {
        void bootstrap();
    }, [bootstrap]);

    const userId = useAuth((s) => s.user?.id ?? null);

    useEffect(() => {
        if (userId !== null && userId !== "") {
            void refreshConversations();
        }
    }, [userId]);
}
