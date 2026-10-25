import { create } from "zustand";

import { agentClient, conversationClient } from "@/data/rpc/clients";
import { errorReason, errorText } from "@/data/rpc/errors";
import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";
import { ErrorReason } from "@/gen/lemma/v1/errors_pb";
import { i18n } from "@/i18n";

import { type AgentItem, hydrateToolResults, protoToItem } from "./agent-item";
import { createStreamReducer } from "./stream-reducer";

interface AgentState {
    conversationId: string | null;
    items: AgentItem[];
    streaming: boolean;
    hasMore: boolean;
    open: (conversationId: string) => Promise<void>;
    loadMore: () => Promise<void>;
    send: (providerId: string, model: string, content: string) => Promise<void>;
    abort: () => Promise<void>;
}

let controller: AbortController | null = null;
let activeMessageId: string | null = null;
let userAborted = false;

const PAGE_SIZE = 50;
const MAX_RESUME = 3;

async function latestPage(
    conversationId: string,
): Promise<Pick<AgentState, "items" | "hasMore">> {
    const res = await conversationClient.listMessages({
        conversationId,
        limit: PAGE_SIZE,
    });
    return {
        items: hydrateToolResults(res.messages.map(protoToItem).toReversed()),
        hasMore: res.hasMore,
    };
}

export const useAgent = create<AgentState>()((set, get) => ({
    conversationId: null,
    items: [],
    streaming: false,
    hasMore: false,

    open: async (conversationId) => {
        set({ conversationId, ...(await latestPage(conversationId)) });
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

        const reducer = createStreamReducer(
            set,
            get,
            providerId,
            model,
            aiTempId,
            (messageId) => {
                activeMessageId = messageId;
            },
        );

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
                    reducer.applyEvent(res.event);
                }
            } catch (e) {
                if (userAborted || signal.aborted) {
                    reducer.updateCurrent({ status: "aborted" });
                    return;
                }
                if (errorReason(e) === ErrorReason.TURN_NOT_RUNNING) {
                    set(await latestPage(conversationId));
                    return;
                }
                const next = resumes + 1;
                if (activeMessageId === null || next > MAX_RESUME) {
                    reducer.updateCurrent({
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
