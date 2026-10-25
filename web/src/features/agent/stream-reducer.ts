import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";

import type { AgentItem } from "./agent-item";

/** The slice of chat state the reducer reads and patches. */
export interface StreamSlice {
    items: AgentItem[];
}

/** Applies a patch computed from the current slice. */
export type StreamSet = (fn: (s: StreamSlice) => Partial<StreamSlice>) => void;

/** Reads the current slice. */
export type StreamGet = () => StreamSlice;

/** Applies one send's stream events to the chat items. */
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

    const startTurn = (messageId: string) => {
        const current = get().items.find((it) => it.id === currentId);
        const empty =
            current !== undefined &&
            current.role === "assistant" &&
            current.content === "" &&
            current.thinking === "" &&
            current.toolCalls.length === 0;
        if (empty) {
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
                    }));
                } else if (part.case === "thinking") {
                    patchCurrent((it) => ({
                        ...it,
                        thinking: it.thinking + part.value.content,
                    }));
                }
                break;
            }
            case "toolCallStarted":
                patchCurrent((it) => ({
                    ...it,
                    toolCalls: [
                        ...it.toolCalls,
                        {
                            id: kind.value.callId,
                            name: kind.value.name,
                            arguments: kind.value.arguments,
                            output: "",
                            isError: false,
                            state: "running",
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
                            ? { ...tc, output: content, isError, state: "done" }
                            : tc,
                    ),
                }));
                break;
            }
            case "done":
                updateCurrent({ status: "done" });
                break;
            case "aborted":
                updateCurrent({ status: "aborted" });
                break;
            case "error":
                updateCurrent({
                    status: "error",
                    error: kind.value.message,
                });
                break;
            case undefined:
                break;
        }
    };

    return { applyEvent, updateCurrent };
}
