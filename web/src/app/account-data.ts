import { clearActiveSession } from "@/features/agent";
import { useAuth } from "@/features/auth";
import { clearSessions } from "@/features/session";
import { clearProviders } from "@/features/provider";

/** Empties every feature store holding account data whenever the signed-in user changes. */
export function installAccountDataReset(): void {
    useAuth.subscribe((state, previous) => {
        if (state.user?.id === previous.user?.id) {
            return;
        }
        clearActiveSession();
        clearSessions();
        clearProviders();
    });
}
