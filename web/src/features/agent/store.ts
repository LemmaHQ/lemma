import { create } from "zustand";

import { getDb } from "@/data/cache/database";
import { listMessages, type MessageRow } from "@/data/cache/records";
import { agentClient, conversationClient } from "@/data/rpc/clients";
import { errorText } from "@/data/rpc/errors";
import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";
import { type Message, MessageStatus } from "@/gen/lemma/v1/conversation_pb";
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
    toolCallId?: string;
    toolIsError?: boolean;
    error?: string;
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

const charLen = (s: string) => Array.from(s).length;

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
        error: m.error || undefined,
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
        status: statusFromProto(m.status as MessageStatus),
        providerId: m.providerId,
        model: m.model,
        toolCalls: [],
    };
}

function hydrateToolResults(items: AgentItem[]): AgentItem[] {
    const resultByCallId = new Map<string, AgentItem>();
    for (const it of items) {
        if (it.role === "tool" && it.toolCallId) {
            resultByCallId.set(it.toolCallId, it);
        }
    }
    return items.map((it) => {
        if (it.role !== "assistant" || it.toolCalls.length === 0) {
            return it;
        }
        return {
            ...it,
            toolCalls: it.toolCalls.map((tc) => {
                const res = resultByCallId.get(tc.id);
                if (!res) {
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

export const useChat = create<ChatState>()((set, get) => ({
    conversationId: null,
    items: [],
    streaming: false,
    hasMore: false,

    open: async (conversationId) => {
        const db = getDb();
        if (db) {
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
        const res = await conversationClient.listMessages({
            conversationId,
            limit: PAGE_SIZE,
        });
        set({
            conversationId,
            items: hydrateToolResults(res.messages.map(protoToItem).reverse()),
            hasMore: res.hasMore,
        });
    },

    syncFromCache: async () => {
        const { conversationId, streaming } = get();
        const db = getDb();
        if (!db || !conversationId || streaming) {
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
        if (!conversationId || !hasMore || items.length === 0) {
            return;
        }
        const res = await conversationClient.listMessages({
            conversationId,
            beforeId: items[0].id,
            limit: PAGE_SIZE,
        });
        set((s) => ({
            items: [
                ...hydrateToolResults(res.messages.map(protoToItem).reverse()),
                ...s.items,
            ],
            hasMore: res.hasMore,
        }));
    },

    send: async (providerId, model, content) => {
        const { conversationId, streaming } = get();
        if (!conversationId || streaming) {
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

        const updateCurrent = (patch: Partial<AgentItem>) =>
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === currentId ? { ...it, ...patch } : it,
                ),
            }));
        const appendText = (chunk: string) =>
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === currentId
                        ? { ...it, content: it.content + chunk }
                        : it,
                ),
            }));
        const appendThinking = (chunk: string) =>
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === currentId
                        ? { ...it, thinking: it.thinking + chunk }
                        : it,
                ),
            }));
        const addToolCall = (call: ToolCallItem) =>
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === currentId
                        ? { ...it, toolCalls: [...it.toolCalls, call] }
                        : it,
                ),
            }));
        const finishToolCall = (
            callId: string,
            output: string,
            isError: boolean,
        ) =>
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === currentId
                        ? {
                              ...it,
                              toolCalls: it.toolCalls.map((tc) =>
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
                        : it,
                ),
            }));

        const startTurn = (messageId: string) => {
            activeMessageId = messageId;
            const current = get().items.find((it) => it.id === currentId);
            const empty =
                current &&
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
            if (!kind) {
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
            }
        };

        try {
            let resumes = 0;
            for (;;) {
                try {
                    if (!activeMessageId) {
                        const stream = agentClient.sendMessage(
                            {
                                conversationId,
                                content,
                                providerId,
                                model,
                                clientMsgId,
                            },
                            { signal },
                        );
                        for await (const res of stream) {
                            applyEvent(res.event);
                        }
                    } else {
                        const current =
                            get().items.find((it) => it.id === currentId)
                                ?.content ?? "";
                        const stream = agentClient.resumeStream(
                            {
                                messageId: activeMessageId,
                                offset: BigInt(charLen(current)),
                            },
                            { signal },
                        );
                        for await (const res of stream) {
                            applyEvent(res.event);
                        }
                    }
                    break;
                } catch (e) {
                    if (userAborted || signal.aborted) {
                        throw e;
                    }
                    resumes += 1;
                    if (!activeMessageId || resumes > MAX_RESUME) {
                        throw e;
                    }
                    await new Promise((r) => setTimeout(r, 500 * resumes));
                }
            }
        } catch (e) {
            if (userAborted || signal.aborted) {
                updateCurrent({ status: "aborted" });
            } else {
                updateCurrent({
                    status: "error",
                    error: errorText(e, i18n.t),
                });
            }
        } finally {
            controller = null;
            activeMessageId = null;
            set({ streaming: false });
        }
    },

    abort: async () => {
        userAborted = true;
        const id = activeMessageId;
        if (id) {
            await agentClient
                .abortMessage({ messageId: id })
                .catch(() => undefined);
        }
        controller?.abort();
    },
}));
