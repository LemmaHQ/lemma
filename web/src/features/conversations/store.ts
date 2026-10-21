import { create } from "zustand";

import { conversationClient } from "@/data/rpc/clients";
import type { Conversation } from "@/gen/lemma/v1/conversation_pb";

interface ConversationsState {
    list: Conversation[];
    loaded: boolean;
    refresh: () => Promise<void>;
    create: () => Promise<string>;
    rename: (id: string, title: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
}

export const useConversationsStore = create<ConversationsState>()((set) => ({
    list: [],
    loaded: false,

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
