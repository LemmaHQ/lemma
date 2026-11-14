import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";
import { ErrorReason } from "@/gen/lemma/v1/errors_pb";
import { errorReason } from "@/rpc/errors";

import type { AgentItem } from "./agent-item";
import { createStreamReducer, type StreamSlice } from "./stream-reducer";
import type { PreparedTurn, TurnStoreSlice } from "./turn-prep";

const MAX_RESUME = 3;

/** Identity and cancellation state for one send. */
export interface Turn {
    controller: AbortController;
    messageId: string | null;
    userAborted: boolean;
}

interface TurnPorts {
    openStream: (
        received: number,
    ) => AsyncIterable<{ event?: AgentEvent | undefined }>;
    applyEvent: (event?: AgentEvent) => void;
    updateCurrent: (patch: Partial<AgentItem>) => void;
    reload: () => Promise<void>;
    failedText: (cause: unknown) => string;
    onReconnecting?: ((offset: number | null) => void) | undefined;
}

/** Parameters to run a send or resumed turn and synchronize store state. */
export interface SessionTurnParams {
    own: Turn;
    prepared: PreparedTurn;
    isCurrent: () => boolean;
    getSlice: () => TurnStoreSlice;
    patchStore: (fn: (s: TurnStoreSlice) => Partial<TurnStoreSlice>) => void;
    openStream: (
        received: number,
        signal: AbortSignal,
    ) => AsyncIterable<{ event?: AgentEvent | undefined }>;
    reload: () => Promise<void>;
    failedText: (cause: unknown) => string;
    onSettled: () => void;
}

function pickStream(s: StreamSlice): StreamSlice {
    return {
        items: s.items,
        currentStep: s.currentStep,
        reconnectingOffset: s.reconnectingOffset,
    };
}

/** Runs one send stream to completion, resuming broken streams in place. */
export async function runTurn(turn: Turn, ports: TurnPorts): Promise<void> {
    let received = 0;
    let reconnecting = false;

    const clearReconnecting = () => {
        if (reconnecting) {
            reconnecting = false;
            ports.onReconnecting?.(null);
        }
    };

    const attempt = async (resumes: number): Promise<void> => {
        try {
            for await (const res of ports.openStream(received)) {
                clearReconnecting();
                received += 1;
                ports.applyEvent(res.event);
            }
            clearReconnecting();
        } catch (e) {
            if (turn.userAborted || turn.controller.signal.aborted) {
                clearReconnecting();
                ports.updateCurrent({ status: "aborted" });
                return;
            }
            if (errorReason(e) === ErrorReason.TURN_NOT_RUNNING) {
                clearReconnecting();
                await ports.reload();
                return;
            }
            const next = resumes + 1;
            if (turn.messageId === null || next > MAX_RESUME) {
                clearReconnecting();
                ports.updateCurrent({
                    status: "error",
                    error: ports.failedText(e),
                });
                return;
            }
            reconnecting = true;
            ports.onReconnecting?.(received);
            const delay = Promise.withResolvers<undefined>();
            setTimeout(() => {
                delay.resolve(undefined);
            }, 500 * next);
            await delay.promise;
            await attempt(next);
        }
    };

    await attempt(0);
}

/** Orchestrates stream reduction, reconnection state, and settled reload for one store turn. */
export async function runSessionTurn(params: SessionTurnParams): Promise<void> {
    const {
        own,
        prepared,
        isCurrent,
        getSlice,
        patchStore,
        openStream,
        reload,
        failedText,
        onSettled,
    } = params;

    const reducer = createStreamReducer(
        (fn) => {
            if (!isCurrent()) {
                return;
            }
            patchStore((s) => {
                const patch = fn(pickStream(s));
                return {
                    ...patch,
                    treeMessages: [
                        ...prepared.preTree,
                        ...patch.items.slice(prepared.baseCount),
                    ],
                };
            });
        },
        () => pickStream(getSlice()),
        prepared.providerId,
        prepared.model,
        prepared.aiTempId,
        (messageId) => {
            own.messageId = messageId;
        },
        prepared.userPlaceholderId,
        (messageId) => {
            if (isCurrent()) {
                patchStore(() => ({ leafId: messageId }));
            }
        },
    );

    const outcome = { reloaded: false, localExit: false };
    try {
        await runTurn(own, {
            openStream: (received) =>
                openStream(received, own.controller.signal),
            applyEvent: reducer.applyEvent,
            updateCurrent: (patch) => {
                outcome.localExit = true;
                reducer.updateCurrent(patch);
            },
            reload: async () => {
                outcome.reloaded = true;
                await reload();
            },
            failedText,
            onReconnecting: (offset: number | null) => {
                if (isCurrent()) {
                    patchStore(() => ({ reconnectingOffset: offset }));
                }
            },
        });
        if (isCurrent() && !outcome.reloaded && !outcome.localExit) {
            await reload().catch(() => {});
        }
    } finally {
        if (isCurrent()) {
            onSettled();
            patchStore(() => ({
                streaming: false,
                turnStartedAtMs: null,
                currentStep: null,
                reconnectingOffset: null,
            }));
        }
    }
}
