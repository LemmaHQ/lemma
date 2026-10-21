import { create as createMessage } from "@bufbuild/protobuf";
import { type Timestamp, TimestampSchema } from "@bufbuild/protobuf/wkt";
import { create } from "zustand";

import { getDb } from "@/data/cache/database";
import { type ConversationRow, listConversations } from "@/data/cache/records";
import { conversationClient } from "@/data/rpc/clients";
import {
    type Conversation,
    ConversationSchema,
} from "@/gen/lemma/v1/conversation_pb";

interface ConversationsState {
    list: Conversation[];
    loaded: boolean;
    hydrateFromCache: () => Promise<void>;
    refresh: () => Promise<void>;
    create: () => Promise<string>;
    rename: (id: string, title: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
}

function toTimestamp(ms: number): Timestamp {
    return createMessage(TimestampSchema, {
        seconds: BigInt(Math.floor(ms / 1000)),
        nanos: (ms % 1000) * 1_000_000,
    });
}

function rowToConversation(r: ConversationRow): Conversation {
    return createMessage(ConversationSchema, {
        id: r.id,
        title: r.title,
        createdAt: toTimestamp(r.createdAtMs),
        updatedAt: toTimestamp(r.updatedAtMs),
    });
}

export const useConversationsStore = create<ConversationsState>()((set) => ({
    list: [],
    loaded: false,

    hydrateFromCache: async () => {
        const db = getDb();
        if (db === null) {
            return;
        }
        const list = await listConversations(db);
        set({ list: list.map(rowToConversation), loaded: true });
    },

    refresh: async () => {
        const res = await conversationClient.listConversations({});
        set({ list: res.conversations, loaded: true });
    },

    create: async () => {
        const res = await conversationClient.createConversation({});
        const conversation = res.conversation;
        if (conversation === undefined) {
            throw new Error("no conversation in response");
        }
        set((s) => ({ list: [conversation, ...s.list] }));
        return conversation.id;
    },

    rename: async (id, title) => {
        const res = await conversationClient.renameConversation({
            id,
            title,
        });
        const conversation = res.conversation;
        if (conversation === undefined) {
            return;
        }
        set((s) => ({
            list: s.list.map((c) => (c.id === id ? conversation : c)),
        }));
    },

    delete: async (id) => {
        await conversationClient.deleteConversation({ id });
        set((s) => ({ list: s.list.filter((c) => c.id !== id) }));
    },
}));
