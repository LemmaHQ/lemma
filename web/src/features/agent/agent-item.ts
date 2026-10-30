import { type Timestamp, timestampDate } from "@bufbuild/protobuf/wkt";

import { type Message, MessageStatus } from "@/gen/lemma/v1/conversation_pb";

export interface ToolCallItem {
    id: string;
    name: string;
    arguments: string;
    output: string;
    isError: boolean;
    state: "running" | "done";
    startedAt?: number | undefined;
    finishedAt?: number | undefined;
}

export interface AgentItem {
    id: string;
    role: "user" | "assistant" | "tool";
    content: string;
    thinking: string;
    status: "streaming" | "done" | "aborted" | "error";
    providerId: string;
    model: string;
    toolCalls: ToolCallItem[];
    toolCallId?: string | undefined;
    toolIsError?: boolean | undefined;
    thinkingStartedAt?: number | undefined;
    thinkingFinishedAt?: number | undefined;
    error?: string | undefined;
}

/** Maps a stored message to its display item. */
export function protoToItem(m: Message): AgentItem {
    return {
        id: m.id,
        role:
            m.role === "user"
                ? "user"
                : m.role === "tool"
                  ? "tool"
                  : "assistant",
        content: m.content,
        thinking: m.thinking,
        status: statusFromProto(m.status),
        providerId: m.providerId,
        model: m.model,
        toolCalls: m.toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
            output: "",
            isError: false,
            state: "done",
            startedAt: epochMillis(tc.startedAt),
            finishedAt: epochMillis(tc.finishedAt),
        })),
        thinkingStartedAt: epochMillis(m.thinkingStartedAt),
        thinkingFinishedAt: epochMillis(m.thinkingFinishedAt),
        toolCallId: m.toolResult?.toolCallId,
        toolIsError: m.toolResult?.isError,
        error: m.error === "" ? undefined : m.error,
    };
}

/** Folds tool-result messages into the assistant items that called them. */
export function hydrateToolResults(items: AgentItem[]): AgentItem[] {
    const resultByCallId = new Map<string, AgentItem>();
    for (const entry of items) {
        if (entry.role === "tool" && entry.toolCallId !== undefined) {
            resultByCallId.set(entry.toolCallId, entry);
        }
    }
    return items.map((entry) => {
        if (entry.role !== "assistant" || entry.toolCalls.length === 0) {
            return entry;
        }
        return {
            ...entry,
            toolCalls: entry.toolCalls.map((tc) => {
                const res = resultByCallId.get(tc.id);
                if (res === undefined) {
                    return tc;
                }
                return {
                    ...tc,
                    output: res.content,
                    isError: res.toolIsError ?? false,
                    state: "done",
                };
            }),
        };
    });
}

function epochMillis(value: Timestamp | undefined): number | undefined {
    return value === undefined ? undefined : timestampDate(value).getTime();
}

function statusFromProto(s: MessageStatus): AgentItem["status"] {
    switch (s) {
        case MessageStatus.STREAMING:
            return "streaming";
        case MessageStatus.ABORTED:
            return "aborted";
        case MessageStatus.ERROR:
            return "error";
        default:
            return "done";
    }
}
