import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { type ActiveSessionState, useActiveSessionStore } from "./store";

export type ActiveSessionViewSlice = Pick<
    ActiveSessionState,
    | "treeMessages"
    | "leafId"
    | "items"
    | "streaming"
    | "turnStartedAtMs"
    | "currentStep"
    | "reconnectingOffset"
    | "rewind"
    | "send"
    | "abort"
    | "switchLeaf"
    | "startRewind"
    | "cancelRewind"
    | "labelMessage"
>;

/** Loads `sessionId` into the active-session store once per session change, excluding `drafts` so keystrokes do not re-render the stage. */
export function useActiveSession(sessionId: string): ActiveSessionViewSlice {
    useEffect(() => {
        const current = useActiveSessionStore.getState();
        if (current.loadedSessionId !== sessionId) {
            void current.open(sessionId);
        }
    }, [sessionId]);

    return useActiveSessionStore(
        useShallow((s) => ({
            treeMessages: s.treeMessages,
            leafId: s.leafId,
            items: s.items,
            streaming: s.streaming,
            turnStartedAtMs: s.turnStartedAtMs,
            currentStep: s.currentStep,
            reconnectingOffset: s.reconnectingOffset,
            rewind: s.rewind,
            send: s.send,
            abort: s.abort,
            switchLeaf: s.switchLeaf,
            startRewind: s.startRewind,
            cancelRewind: s.cancelRewind,
            labelMessage: s.labelMessage,
        })),
    );
}
