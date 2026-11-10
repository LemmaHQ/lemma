import { timestampDate } from "@bufbuild/protobuf/wkt";

import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";

import { type AgentItem, isBlankReply } from "./agent-item";

/** The slice of active session state the reducer reads and patches. */
export interface StreamSlice {
    items: AgentItem[];
}

/** Applies a patch computed from the current slice. */
export type StreamSet = (fn: (s: StreamSlice) => Partial<StreamSlice>) => void;

/** Reads the current slice. */
export type StreamGet = () => StreamSlice;

/** Applies one send's stream events to the session items. */
export interface StreamReducer {
    applyEvent: (event?: AgentEvent) => void;
    updateCurrent: (patch: Partial<AgentItem>) => void;
}

/** Creates the reducer for one send call, tracking its current item. */
export function createStreamReducer(
    set: StreamSet,
    get: StreamGet,
    providerId: string,
    model: string,
    initialId: string,
    onStarted: (messageId: string) => void,
): StreamReducer {
    let currentId = initialId;

    const patchCurrent = (fn: (it: AgentItem) => AgentItem) => {
        set((s) => ({
            items: s.items.map((it) => (it.id === currentId ? fn(it) : it)),
        }));
    };

    const updateCurrent = (patch: Partial<AgentItem>) => {
        patchCurrent((it) => ({ ...it, ...patch }));
    };

    const finishReply = (
        at: number | undefined,
        status: AgentItem["status"],
        patch: Partial<AgentItem> = {},
    ) => {
        patchCurrent((it) => ({
            ...it,
            status,
            ...patch,
            thinkingFinishedAt: closedThinkingAt(it, at),
        }));
    };

    const startTurn = (messageId: string) => {
        const current = get().items.find((it) => it.id === currentId);
        if (
            current !== undefined &&
            current.role === "assistant" &&
            isBlankReply(current)
        ) {
            updateCurrent({ id: messageId });
            currentId = messageId;
            return;
        }
        set((s) => ({
            items: [
                ...s.items,
                {
                    id: messageId,
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
                onStarted(kind.value.messageId);
                break;
            case "turnStarted":
                startTurn(kind.value.messageId);
                break;
            case "delta": {
                const part = kind.value.part;
                if (part.case === "text") {
                    patchCurrent((it) => ({
                        ...it,
                        content: it.content + part.value.content,
                        thinkingFinishedAt: closedThinkingAt(it, at),
                    }));
                } else if (part.case === "thinking") {
                    patchCurrent((it) => ({
                        ...it,
                        thinking: it.thinking + part.value.content,
                        thinkingStartedAt: it.thinkingStartedAt ?? at,
                    }));
                }
                break;
            }
            case "toolCallStarted":
                patchCurrent((it) => ({
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
                }));
                break;
            case "toolCallFinished": {
                const { callId, content, isError } = kind.value;
                patchCurrent((it) => ({
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
                }));
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
