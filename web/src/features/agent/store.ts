import { create } from "zustand";

import { getDb } from "@/data/cache/database";
import { listMessages, type MessageRow } from "@/data/cache/records";
import { agentClient, conversationClient } from "@/data/rpc/clients";
import { errorText } from "@/data/rpc/errors";
import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";
import { type Message, MessageStatus } from "@/gen/lemma/v1/conversation_pb";
import { i18n } from "@/i18n";

export interface AgentItem {
    id: string;
    role: "user" | "assistant";
    content: string;
    thinking: string;
    status: "streaming" | "done" | "aborted" | "error";
    providerId: string;
    model: string;
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
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
        thinking: m.thinking,
        status: statusFromProto(m.status),
        providerId: m.providerId,
        model: m.model,
        error: m.error || undefined,
    };
}

function rowToItem(m: MessageRow): AgentItem {
    return {
        id: m.id,
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
        thinking: "",
        status: statusFromProto(m.status as MessageStatus),
        providerId: m.providerId,
        model: m.model,
    };
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
                    items: rows.map(rowToItem),
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
            items: res.messages.map(protoToItem).reverse(),
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
        set({ items: rows.map(rowToItem), hasMore: false });
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
            items: [...res.messages.map(protoToItem).reverse(), ...s.items],
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
                },
                {
                    id: aiTempId,
                    role: "assistant",
                    content: "",
                    thinking: "",
                    status: "streaming",
                    providerId,
                    model,
                },
            ],
        }));

        const updateAi = (patch: Partial<AgentItem>) =>
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === aiTempId ? { ...it, ...patch } : it,
                ),
            }));
        const appendAi = (chunk: string) =>
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === aiTempId
                        ? { ...it, content: it.content + chunk }
                        : it,
                ),
            }));
        const appendThinking = (chunk: string) =>
            set((s) => ({
                items: s.items.map((it) =>
                    it.id === aiTempId
                        ? { ...it, thinking: it.thinking + chunk }
                        : it,
                ),
            }));

        const applyEvent = (event?: AgentEvent) => {
            const kind = event?.kind;
            if (!kind) {
                return;
            }
            switch (kind.case) {
                case "started":
                    activeMessageId = kind.value.messageId;
                    break;
                case "delta": {
                    const part = kind.value.part;
                    if (part.case === "text") {
                        appendAi(part.value.content);
                    } else if (part.case === "thinking") {
                        appendThinking(part.value.content);
                    }
                    break;
                }
                case "done":
                    updateAi({ status: "done" });
                    break;
                case "aborted":
                    updateAi({ status: "aborted" });
                    break;
                case "error":
                    updateAi({ status: "error", error: kind.value.message });
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
                            get().items.find((it) => it.id === aiTempId)
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
                updateAi({ status: "aborted" });
            } else {
                updateAi({ status: "error", error: errorText(e, i18n.t) });
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
