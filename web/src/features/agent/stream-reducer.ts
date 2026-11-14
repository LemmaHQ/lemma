import { timestampDate } from "@bufbuild/protobuf/wkt";

import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";

import { type AgentItem, isBlankReply } from "./agent-item";

/** Live execution phase shown while an assistant turn is streaming. */
export type LiveStep =
    { kind: "thinking" } | { kind: "tool"; name: string } | null;

/** The slice of active session state the reducer reads and patches. */
export interface StreamSlice {
    items: AgentItem[];
    currentStep: LiveStep;
    reconnectingOffset: number | null;
}

/** Applies a patch computed from the current slice. */
export type StreamSet = (
    fn: (s: StreamSlice) => Partial<StreamSlice> & { items: AgentItem[] },
) => void;

/** Reads the current slice. */
export type StreamGet = () => StreamSlice;

/** Applies one send's stream events to the session items. */
export interface StreamReducer {
    applyEvent: (event?: AgentEvent) => void;
    updateCurrent: (patch: Partial<AgentItem>) => void;
}

export interface StreamReducerOptions {
    set: StreamSet;
    get: StreamGet;
    providerId: string;
    model: string;
    initialId: string;
    userPlaceholderId?: string | undefined;
    onStarted: (messageId: string, parentId?: string) => void;
    onTurnStarted?: ((messageId: string) => void) | undefined;
}

/** Creates the reducer for one send call, tracking its current item. */
export function createStreamReducer({
    set,
    get,
    providerId,
    model,
    initialId,
    userPlaceholderId,
    onStarted,
    onTurnStarted,
}: StreamReducerOptions): StreamReducer {
    let currentId = initialId;
    let currentUserId = userPlaceholderId;

    const patchCurrent = (
        fn: (it: AgentItem) => AgentItem,
        extra: (it: AgentItem) => Partial<StreamSlice>,
    ) => {
        set((s) => {
            let sliceExtra: Partial<StreamSlice> = {};
            const items = s.items.map((it) => {
                if (it.id !== currentId) {
                    return it;
                }
                const next = fn(it);
                sliceExtra = extra(next);
                return next;
            });
            return { items, ...sliceExtra };
        });
    };

    const updateCurrent = (patch: Partial<AgentItem>) => {
        patchCurrent(
            (it) => ({ ...it, ...patch }),
            (next) =>
                next.status === "streaming" ? {} : { currentStep: null },
        );
    };

    const finishReply = (
        at: number | undefined,
        status: AgentItem["status"],
        patch: Partial<AgentItem> = {},
    ) => {
        patchCurrent(
            (it) => ({
                ...it,
                status,
                ...patch,
                thinkingFinishedAt: closedThinkingAt(it, at),
            }),
            () => ({ currentStep: null }),
        );
    };

    const startUser = (messageId: string, rawParentId: string | undefined) => {
        const parentId =
            rawParentId === undefined || rawParentId === ""
                ? undefined
                : rawParentId;
        if (currentUserId !== undefined) {
            const prevUserId = currentUserId;
            currentUserId = messageId;
            set((s) => ({
                items: s.items.map((it) => {
                    if (it.id === prevUserId) {
                        return { ...it, id: messageId, parentId };
                    }
                    if (it.parentId === prevUserId) {
                        return { ...it, parentId: messageId };
                    }
                    return it;
                }),
            }));
        }
        onStarted(messageId, parentId);
    };

    const startTurn = (messageId: string, rawParentId: string) => {
        const parentId = rawParentId === "" ? undefined : rawParentId;
        const current = get().items.find((it) => it.id === currentId);
        if (
            current !== undefined &&
            current.role === "assistant" &&
            isBlankReply(current)
        ) {
            set((s) => ({
                currentStep: null,
                items: s.items.map((it) =>
                    it.id === currentId
                        ? { ...it, id: messageId, parentId }
                        : it,
                ),
            }));
            currentId = messageId;
            onTurnStarted?.(messageId);
            return;
        }
        set((s) => ({
            currentStep: null,
            items: [
                ...s.items,
                {
                    id: messageId,
                    parentId,
                    role: "assistant",
                    content: "",
                    thinking: "",
                    status: "streaming",
                    providerId,
                    model,
                    toolCalls: [],
                },
            ],
        }));
        currentId = messageId;
        onTurnStarted?.(messageId);
    };

    const applyEvent = (event?: AgentEvent) => {
        const kind = event?.kind;
        if (kind === undefined) {
            return;
        }
        const occurredAt = event?.occurredAt;
        const at =
            occurredAt === undefined
                ? undefined
                : timestampDate(occurredAt).getTime();
        switch (kind.case) {
            case "started":
                startUser(kind.value.messageId, kind.value.parentId);
                break;
            case "turnStarted":
                startTurn(kind.value.messageId, kind.value.parentId);
                break;
            case "delta": {
                const part = kind.value.part;
                if (part.case === "text") {
                    patchCurrent(
                        (it) => ({
                            ...it,
                            content: it.content + part.value.content,
                            thinkingFinishedAt: closedThinkingAt(it, at),
                        }),
                        () => ({ currentStep: null }),
                    );
                } else if (part.case === "thinking") {
                    patchCurrent(
                        (it) => ({
                            ...it,
                            thinking: it.thinking + part.value.content,
                            thinkingStartedAt: it.thinkingStartedAt ?? at,
                        }),
                        () => ({ currentStep: { kind: "thinking" } }),
                    );
                }
                break;
            }
            case "toolCallStarted":
                patchCurrent(
                    (it) => ({
                        ...it,
                        thinkingFinishedAt: closedThinkingAt(it, at),
                        toolCalls: [
                            ...it.toolCalls,
                            {
                                id: kind.value.callId,
                                name: kind.value.name,
                                arguments: kind.value.arguments,
                                output: "",
                                isError: false,
                                state: "running",
                                startedAt: at,
                            },
                        ],
                    }),
                    () => ({
                        currentStep: { kind: "tool", name: kind.value.name },
                    }),
                );
                break;
            case "toolCallFinished": {
                const { callId, content, isError } = kind.value;
                patchCurrent(
                    (it) => ({
                        ...it,
                        toolCalls: it.toolCalls.map((tc) =>
                            tc.id === callId
                                ? {
                                      ...tc,
                                      output: content,
                                      isError,
                                      state: "done",
                                      finishedAt: at,
                                  }
                                : tc,
                        ),
                    }),
                    (next) => {
                        const running = next.toolCalls.find(
                            (tc) => tc.state === "running",
                        );
                        return {
                            currentStep:
                                running === undefined
                                    ? null
                                    : { kind: "tool", name: running.name },
                        };
                    },
                );
                break;
            }
            case "done":
                finishReply(at, "done");
                break;
            case "aborted":
                finishReply(at, "aborted");
                break;
            case "error":
                finishReply(at, "error", {
                    error:
                        kind.value.message === ""
                            ? undefined
                            : kind.value.message,
                });
                break;
            case undefined:
                break;
        }
    };

    return { applyEvent, updateCurrent };
}

function closedThinkingAt(
    item: AgentItem,
    at: number | undefined,
): number | undefined {
    return item.thinkingStartedAt === undefined
        ? undefined
        : (item.thinkingFinishedAt ?? at);
}
