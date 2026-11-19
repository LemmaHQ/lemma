import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";

import { MessageStatus, type Message } from "@/gen/lemma/v1/session_pb";

export interface UiToolCall {
    id: string;
    name: string;
    arguments: string;
    output: string;
    isError: boolean;
    state: "running" | "done";
    startedAt?: number | undefined;
    finishedAt?: number | undefined;
}

export interface UiMessage {
    id: string;
    parentId?: string | undefined;
    role: "user" | "assistant" | "tool";
    content: string;
    thinking: string;
    status: "streaming" | "done" | "aborted" | "error";
    providerId: string;
    model: string;
    toolCalls: UiToolCall[];
    toolCallId?: string | undefined;
    toolIsError?: boolean | undefined;
    thinkingStartedAt?: number | undefined;
    thinkingFinishedAt?: number | undefined;
    createdAtMs?: number | undefined;
    label?: string | undefined;
    error?: string | undefined;
}

/** True when an assistant reply has produced no reasoning, text, or tool call. */
export function isBlankReply(item: UiMessage): boolean {
    return (
        item.content === "" &&
        item.thinking === "" &&
        item.toolCalls.length === 0
    );
}

/** Maps a stored message to its UI message. */
export function toUiMessage(m: Message): UiMessage {
    return {
        id: m.id,
        parentId:
            m.parentId === undefined || m.parentId === ""
                ? undefined
                : m.parentId,
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
        createdAtMs: epochMillis(m.createdAt),
        label: m.label === undefined || m.label === "" ? undefined : m.label,
        toolCallId: m.toolResult?.toolCallId,
        toolIsError: m.toolResult?.isError,
        error: m.error === "" ? undefined : m.error,
    };
}

/** Folds tool-result messages into the assistant items that called them. */
export function hydrateToolResults(items: UiMessage[]): UiMessage[] {
    const resultByCallId = new Map<string, UiMessage>();
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

function statusFromProto(s: MessageStatus): UiMessage["status"] {
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
