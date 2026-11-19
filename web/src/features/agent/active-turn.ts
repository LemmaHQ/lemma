import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";
import { ErrorReason } from "@/gen/lemma/v1/errors_pb";
import { errorReason } from "@/rpc/errors";

import {
    prepareNewTurn,
    prepareResumedTurn,
    type PreparedTurn,
    type TurnStoreSlice,
} from "./active-path";
import { createTurnEventReducer } from "./turn-event-reducer";
import type { UiMessage } from "./ui-message";

const MAX_RESUME = 3;

export interface SendTurnRequest {
    sessionId: string;
    content: string;
    providerId: string;
    model: string;
    parentId?: string | undefined;
}

/** Seam callbacks provided once by the session store to drive RPC and state patches. */
export interface ActiveTurnPorts {
    getSlice: () => TurnStoreSlice;
    patchStore: (
        patch:
            | Partial<TurnStoreSlice & { rewind: null }>
            | ((s: TurnStoreSlice) => Partial<TurnStoreSlice>),
    ) => void;
    sendMessage: (
        req: SendTurnRequest,
        signal: AbortSignal,
    ) => AsyncIterable<{ event?: AgentEvent | undefined }>;
    resumeStream: (
        messageId: string,
        offset: bigint,
        signal: AbortSignal,
    ) => AsyncIterable<{ event?: AgentEvent | undefined }>;
    abortMessage: (messageId: string) => Promise<unknown>;
    reload: (sessionId: string, isCurrent: () => boolean) => Promise<void>;
    failedText: (cause: unknown) => string;
    onUserMessageStarted?:
        ((sessionId: string, messageId: string) => void) | undefined;
    onTurnOutcome?:
        | ((sessionId: string, outcome: "done" | "error" | "aborted") => void)
        | undefined;
}

interface LiveTurn {
    controller: AbortController;
    messageId: string | null;
}

/** Owns the single active turn lifecycle: optimistic prep, stream reduction, reconnection, and abort. */
export function createActiveTurnRunner(ports: ActiveTurnPorts) {
    let active: LiveTurn | null = null;

    const execute = async (
        sessionId: string,
        own: LiveTurn,
        prepared: PreparedTurn,
        openStream: (
            received: number,
            signal: AbortSignal,
        ) => AsyncIterable<{ event?: AgentEvent | undefined }>,
    ): Promise<void> => {
        active = own;
        const isCurrent = () => active === own;
        ports.patchStore({ ...prepared.patch, rewind: null });

        const reducer = createTurnEventReducer({
            set: (fn) => {
                if (!isCurrent()) {
                    return;
                }
                ports.patchStore((s) => {
                    const patch = fn(s);
                    return {
                        ...patch,
                        treeMessages: [
                            ...prepared.preTree,
                            ...patch.items.slice(prepared.baseCount),
                        ],
                    };
                });
            },
            get: ports.getSlice,
            providerId: prepared.providerId,
            model: prepared.model,
            initialId: prepared.aiTempId,
            userPlaceholderId: prepared.userPlaceholderId,
            onStarted: (messageId) => {
                own.messageId = messageId;
                ports.onUserMessageStarted?.(sessionId, messageId);
            },
            onTurnStarted: (messageId) => {
                if (isCurrent()) {
                    ports.patchStore({ leafId: messageId });
                }
            },
        });

        const outcome: {
            handled: boolean;
            status: "done" | "error" | "aborted";
        } = { handled: false, status: "done" };
        try {
            await consumeWithReconnect(own, {
                openStream: (n) => openStream(n, own.controller.signal),
                applyEvent: (event) => {
                    if (event?.kind.case === "error") {
                        outcome.status = "error";
                    } else if (event?.kind.case === "aborted") {
                        outcome.status = "aborted";
                    }
                    reducer.applyEvent(event);
                },
                onAborted: () => {
                    outcome.handled = true;
                    outcome.status = "aborted";
                    reducer.updateCurrent({ status: "aborted" });
                },
                onFailed: (cause) => {
                    outcome.handled = true;
                    outcome.status = "error";
                    reducer.updateCurrent({
                        status: "error",
                        error: ports.failedText(cause),
                    });
                },
                onTurnFinishedRemotely: async () => {
                    outcome.handled = true;
                    await ports.reload(sessionId, isCurrent);
                },
                onReconnecting: (reconnectingOffset) => {
                    if (isCurrent()) {
                        ports.patchStore({ reconnectingOffset });
                    }
                },
            });
            if (isCurrent() && !outcome.handled) {
                await ports.reload(sessionId, isCurrent).catch(() => {});
            }
        } finally {
            if (isCurrent()) {
                active = null;
                ports.patchStore({
                    streaming: false,
                    turnStartedAtMs: null,
                    currentStep: null,
                    reconnectingOffset: null,
                });
                ports.onTurnOutcome?.(sessionId, outcome.status);
            }
        }
    };

    return {
        isCurrentMessage: (messageId: string): boolean =>
            active?.messageId === messageId,
        cancel: (): void => {
            active?.controller.abort();
            active = null;
        },
        send: async (input: {
            sessionId: string;
            treeMessages: UiMessage[];
            targetParentId: string | undefined;
            requestParentId: string | undefined;
            providerId: string;
            model: string;
            content: string;
        }): Promise<void> => {
            const prepared = prepareNewTurn(
                input.treeMessages,
                input.targetParentId,
                input.providerId,
                input.model,
                input.content,
            );
            const own: LiveTurn = {
                controller: new AbortController(),
                messageId: null,
            };
            await execute(input.sessionId, own, prepared, (n, signal) =>
                own.messageId === null
                    ? ports.sendMessage(
                          {
                              sessionId: input.sessionId,
                              content: input.content,
                              providerId: input.providerId,
                              model: input.model,
                              parentId: input.requestParentId,
                          },
                          signal,
                      )
                    : ports.resumeStream(own.messageId, BigInt(n), signal),
            );
        },
        resume: async (input: {
            sessionId: string;
            treeMessages: UiMessage[];
            activeMessageId: string;
        }): Promise<void> => {
            const prepared = prepareResumedTurn(
                input.treeMessages,
                input.activeMessageId,
            );
            const own: LiveTurn = {
                controller: new AbortController(),
                messageId: input.activeMessageId,
            };
            await execute(input.sessionId, own, prepared, (n, signal) =>
                ports.resumeStream(input.activeMessageId, BigInt(n), signal),
            );
        },
        abort: async (): Promise<void> => {
            const current = active;
            if (current === null) {
                return;
            }
            current.controller.abort();
            if (current.messageId !== null) {
                await ports.abortMessage(current.messageId).catch(() => {});
            }
        },
    };
}

async function consumeWithReconnect(
    turn: LiveTurn,
    h: {
        openStream: (
            n: number,
        ) => AsyncIterable<{ event?: AgentEvent | undefined }>;
        applyEvent: (event?: AgentEvent) => void;
        onAborted: () => void;
        onFailed: (cause: unknown) => void;
        onTurnFinishedRemotely: () => Promise<void>;
        onReconnecting: (offset: number | null) => void;
    },
): Promise<void> {
    let received = 0;
    let reconnecting = false;
    const clear = () => {
        if (reconnecting) {
            reconnecting = false;
            h.onReconnecting(null);
        }
    };
    const attempt = async (resumes: number): Promise<void> => {
        try {
            for await (const res of h.openStream(received)) {
                clear();
                received += 1;
                h.applyEvent(res.event);
            }
            clear();
        } catch (cause) {
            clear();
            if (turn.controller.signal.aborted) {
                h.onAborted();
                return;
            }
            if (errorReason(cause) === ErrorReason.TURN_NOT_RUNNING) {
                await h.onTurnFinishedRemotely();
                return;
            }
            const next = resumes + 1;
            if (turn.messageId === null || next > MAX_RESUME) {
                h.onFailed(cause);
                return;
            }
            reconnecting = true;
            h.onReconnecting(received);
            const delay = Promise.withResolvers<undefined>();
            setTimeout(() => delay.resolve(undefined), 500 * next);
            await delay.promise;
            await attempt(next);
        }
    };
    await attempt(0);
}
