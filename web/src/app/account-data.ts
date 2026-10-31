import { clearActiveConversation } from "@/features/agent";
import { useAuth } from "@/features/auth";
import { clearConversations } from "@/features/conversations";
import { clearProviders } from "@/features/providers";

/** Empties every feature store holding account data whenever the signed-in user changes. */
export function installAccountDataReset(): void {
    useAuth.subscribe((state, previous) => {
        if (state.user?.id === previous.user?.id) {
            return;
        }
        clearActiveConversation();
        clearConversations();
        clearProviders();
    });
}
