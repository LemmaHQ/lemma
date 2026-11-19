import { createLoadedHook } from "@/store/loaded-hook";

import { useSessionStore } from "./store";

export function refreshSessions(): Promise<void> {
    return useSessionStore.getState().refresh();
}

/** Creates an empty session, optionally bound to `directory`, and returns its id. */
export function createSession(directory?: string): Promise<string> {
    return useSessionStore.getState().create(directory);
}

export const useSessions = createLoadedHook(useSessionStore);

export function markSessionSeen(id: string): void {
    useSessionStore.getState().markSeen(id);
}

export function setSessionActiveTurn(
    id: string,
    activeMessageId: string | undefined,
): void {
    useSessionStore.getState().setActiveTurn(id, activeMessageId);
}

export function markSessionTurnFinished(
    id: string,
    status: "done" | "error",
    isViewing: boolean,
): void {
    useSessionStore.getState().markTurnFinished(id, status, isViewing);
}
