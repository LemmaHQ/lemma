import { create } from "zustand";

import { getDb } from "@/data/cache/database";
import { listMessages, type MessageRow } from "@/data/cache/records";
import { agentClient, conversationClient } from "@/data/rpc/clients";
import { errorReason, errorText } from "@/data/rpc/errors";
import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";
import { type Message, MessageStatus } from "@/gen/lemma/v1/conversation_pb";
import { ErrorReason } from "@/gen/lemma/v1/errors_pb";
import { i18n } from "@/i18n";

export interface ToolCallItem {
    id: string;
    name: string;
    arguments: string;
    output: string;
    isError: boolean;
    state: "running" | "done";
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
    error?: string | undefined;
}

interface ChatState {
    conversationId: string | null;
    items: AgentItem[];
    streaming: boolean;
    hasMore: boolean;
    open: (conversationId: string) => Promise<void>;
    syncFromCache: () => Promise<void>;
    loadMore: () => Promise<void>;
    send: (providerId: string, model: string, content: string) => Promise<void>;
    abort: () => Promise<void>;
}

let controller: AbortController | null = null;
let activeMessageId: string | null = null;
let userAborted = false;

const PAGE_SIZE = 50;
const MAX_RESUME = 3;

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

function protoToItem(m: Message): AgentItem {
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
        })),
        toolCallId: m.toolResult?.toolCallId,
        toolIsError: m.toolResult?.isError,
        error: m.error === "" ? undefined : m.error,
    };
}

function rowToItem(m: MessageRow): AgentItem {
    return {
        id: m.id,
        role:
            m.role === "user"
                ? "user"
                : m.role === "tool"
                  ? "tool"
                  : "assistant",
        content: m.content,
        thinking: "",
        status: statusFromProto(m.status),
        providerId: m.providerId,
        model: m.model,
        toolCalls: [],
    };
}

function hydrateToolResults(items: AgentItem[]): AgentItem[] {
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

async function latestPage(
    conversationId: string,
): Promise<Pick<ChatState, "items" | "hasMore">> {
    const res = await conversationClient.listMessages({
        conversationId,
        limit: PAGE_SIZE,
    });
    return {
        items: hydrateToolResults(res.messages.map(protoToItem).toReversed()),
        hasMore: res.hasMore,
    };
}

export const useChat = create<ChatState>()((set, get) => ({
    conversationId: null,
    items: [],
    streaming: false,
    hasMore: false,

    open: async (conversationId) => {
        const db = getDb();
        if (db !== null) {
            const rows = await listMessages(db, conversationId);
            if (rows.length > 0) {
                set({
                    conversationId,
                    items: hydrateToolResults(rows.map(rowToItem)),
                    hasMore: false,
                });
                return;
            }
        }
        set({ conversationId, ...(await latestPage(conversationId)) });
    },

    syncFromCache: async () => {
        const { conversationId, streaming } = get();
        const db = getDb();
        if (db === null || conversationId === null || streaming) {
            return;
        }
        const rows = await listMessages(db, conversationId);
        set({
            items: hydrateToolResults(rows.map(rowToItem)),
            hasMore: false,
        });
    },

    loadMore: async () => {
        const { conversationId, items, hasMore } = get();
        const first = items.at(0);
        if (conversationId === null || !hasMore || first === undefined) {
            return;
        }
        const res = await conversationClient.listMessages({
            conversationId,
            beforeId: first.id,
            limit: PAGE_SIZE,
        });
        set((s) => ({
            items: [
                ...hydrateToolResults(
                    res.messages.map(protoToItem).toReversed(),
                ),
                ...s.items,
            ],
            hasMore: res.hasMore,
        }));
    },

    send: async (providerId, model, content) => {
        const { conversationId, streaming } = get();
        if (conversationId === null || streaming) {
            return;
        }

        const clientMsgId = crypto.randomUUID();
        const aiTempId = `${clientMsgId}:ai`;
        controller = new AbortController();
        const { signal } = controller;
        activeMessageId = null;
        userAborted = false;
        let currentId = aiTempId;

        set((s) => ({
            streaming: true,
            items: [
                ...s.items,
                {
                    id: clientMsgId,
                    role: "user",
                    content,
                    thinking: "",
                    status: "done",
                    providerId: "",
                    model: "",
                    toolCalls: [],
                },
                {
                    id: aiTempId,
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

        const updateCurrent = (patch: Partial<AgentItem>) => {
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === currentId ? { ...it, ...patch } : it,
                ),
            }));
        };
        const appendText = (chunk: string) => {
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === currentId
                        ? { ...it, content: it.content + chunk }
                        : it,
                ),
            }));
        };
        const appendThinking = (chunk: string) => {
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === currentId
                        ? { ...it, thinking: it.thinking + chunk }
                        : it,
                ),
            }));
        };
        const addToolCall = (call: ToolCallItem) => {
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === currentId
                        ? { ...it, toolCalls: [...it.toolCalls, call] }
                        : it,
                ),
            }));
        };
        const finishToolCall = (
            callId: string,
            output: string,
            isError: boolean,
        ) => {
            set((s) => ({
                items: s.items.map((entry) =>
                    entry.id === currentId
                        ? {
                              ...entry,
                              toolCalls: entry.toolCalls.map((tc) =>
                                  tc.id === callId
                                      ? {
                                            ...tc,
                                            output,
                                            isError,
                                            state: "done",
                                        }
                                      : tc,
                              ),
                          }
                        : entry,
                ),
            }));
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
                set((s) => ({
                    items: s.items.map((it) =>
                        it.id === currentId ? { ...it, id: messageId } : it,
                    ),
                }));
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
                    activeMessageId = kind.value.messageId;
                    break;
                case "turnStarted":
                    startTurn(kind.value.messageId);
                    break;
                case "delta": {
                    const part = kind.value.part;
                    if (part.case === "text") {
                        appendText(part.value.content);
                    } else if (part.case === "thinking") {
                        appendThinking(part.value.content);
                    }
                    break;
                }
                case "toolCallStarted":
                    addToolCall({
                        id: kind.value.callId,
                        name: kind.value.name,
                        arguments: kind.value.arguments,
                        output: "",
                        isError: false,
                        state: "running",
                    });
                    break;
                case "toolCallFinished":
                    finishToolCall(
                        kind.value.callId,
                        kind.value.content,
                        kind.value.isError,
                    );
                    break;
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

        let received = 0;
        const openStream = (): AsyncIterable<{
            event?: AgentEvent | undefined;
        }> => {
            const resumeId = activeMessageId;
            if (resumeId !== null) {
                return agentClient.resumeStream(
                    { messageId: resumeId, offset: BigInt(received) },
                    { signal },
                );
            }
            return agentClient.sendMessage(
                {
                    conversationId,
                    content,
                    providerId,
                    model,
                    clientMsgId,
                },
                { signal },
            );
        };

        const attempt = async (resumes: number): Promise<void> => {
            try {
                for await (const res of openStream()) {
                    received += 1;
                    applyEvent(res.event);
                }
            } catch (e) {
                if (userAborted || signal.aborted) {
                    updateCurrent({ status: "aborted" });
                    return;
                }
                if (errorReason(e) === ErrorReason.TURN_NOT_RUNNING) {
                    set(await latestPage(conversationId));
                    return;
                }
                const next = resumes + 1;
                if (activeMessageId === null || next > MAX_RESUME) {
                    updateCurrent({
                        status: "error",
                        error: errorText(e, i18n.t),
                    });
                    return;
                }
                await new Promise<void>((resolve) => {
                    setTimeout(resolve, 500 * next);
                });
                await attempt(next);
            }
        };

        try {
            await attempt(0);
        } finally {
            controller = null;
            activeMessageId = null;
            set({ streaming: false });
        }
    },

    abort: async () => {
        userAborted = true;
        const id = activeMessageId;
        if (id !== null) {
            await agentClient.abortMessage({ messageId: id }).catch(() => {});
        }
        controller?.abort();
    },
}));
