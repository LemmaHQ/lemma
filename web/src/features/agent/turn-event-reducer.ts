import { timestampDate } from "@bufbuild/protobuf/wkt";

import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";

import { isBlankReply, type UiMessage } from "./ui-message";

/** Live execution phase shown while an assistant turn is streaming. */
export type LiveStep =
    { kind: "thinking" } | { kind: "tool"; name: string } | null;

/** The slice of active session state the reducer reads and patches. */
export interface TurnEventSlice {
    items: UiMessage[];
    currentStep: LiveStep;
    reconnectingOffset: number | null;
}

/** Applies a patch computed from the current slice. */
export type TurnEventSet = (
    fn: (s: TurnEventSlice) => Partial<TurnEventSlice> & { items: UiMessage[] },
) => void;

/** Reads the current slice. */
export type TurnEventGet = () => TurnEventSlice;

/** Applies one send's turn events to the session items. */
export interface TurnEventReducer {
    applyEvent: (event?: AgentEvent) => void;
    updateCurrent: (patch: Partial<UiMessage>) => void;
}

export interface TurnEventReducerOptions {
    set: TurnEventSet;
    get: TurnEventGet;
    providerId: string;
    model: string;
    initialId: string;
    userPlaceholderId?: string | undefined;
    onStarted: (messageId: string, parentId?: string) => void;
    onTurnStarted?: ((messageId: string) => void) | undefined;
}

/** Creates the reducer for one send call, tracking its current item. */
export function createTurnEventReducer({
    set,
    get,
    providerId,
    model,
    initialId,
    userPlaceholderId,
    onStarted,
    onTurnStarted,
}: TurnEventReducerOptions): TurnEventReducer {
    let currentId = initialId;
    let currentUserId = userPlaceholderId;

    const patchCurrent = (
        fn: (it: UiMessage) => UiMessage,
        extra: (it: UiMessage) => Partial<TurnEventSlice>,
    ) => {
        set((s) => {
            let sliceExtra: Partial<TurnEventSlice> = {};
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

    const updateCurrent = (patch: Partial<UiMessage>) => {
        patchCurrent(
            (it) => ({ ...it, ...patch }),
            (next) =>
                next.status === "streaming" ? {} : { currentStep: null },
        );
    };

    const finishReply = (
        at: number | undefined,
        status: UiMessage["status"],
        patch: Partial<UiMessage> = {},
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
    item: UiMessage,
    at: number | undefined,
): number | undefined {
    return item.thinkingStartedAt === undefined
        ? undefined
        : (item.thinkingFinishedAt ?? at);
}
