import { timestampDate } from "@bufbuild/protobuf/wkt";
import { create } from "zustand";

import { conversationClient } from "@/rpc/clients";
import type { Conversation } from "@/gen/lemma/v1/conversation_pb";

import type { SessionSummary } from "./grouping";

interface ConversationsState {
    list: SessionSummary[];
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
        set({ list: res.conversations.map(toSummary), loaded: true });
    },

    create: async () => {
        const res = await conversationClient.createConversation({});
        if (res.conversation === undefined) {
            throw new Error("no conversation in response");
        }
        const conversation = toSummary(res.conversation);
        set((s) => ({ list: [conversation, ...s.list] }));
        return conversation.id;
    },

    rename: async (id, title) => {
        const res = await conversationClient.renameConversation({
            id,
            title,
        });
        if (res.conversation === undefined) {
            return;
        }
        const conversation = toSummary(res.conversation);
        set((s) => ({
            list: s.list.map((c) => (c.id === id ? conversation : c)),
        }));
    },

    delete: async (id) => {
        await conversationClient.deleteConversation({ id });
        set((s) => ({ list: s.list.filter((c) => c.id !== id) }));
    },
}));

function toSummary(c: Conversation): SessionSummary {
    return {
        id: c.id,
        title: c.title,
        updatedAtMs:
            c.updatedAt === undefined
                ? 0
                : timestampDate(c.updatedAt).getTime(),
    };
}
