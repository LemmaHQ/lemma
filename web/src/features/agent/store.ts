import { create } from "zustand";

import { agentClient, conversationClient } from "@/rpc/clients";
import { errorReason } from "@/rpc/errors";
import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";
import { ErrorReason } from "@/gen/lemma/v1/errors_pb";
import { i18n } from "@/i18n";
import { errorText } from "@/i18n/error-text";

import { type AgentItem, hydrateToolResults, protoToItem } from "./agent-item";
import { createStreamReducer } from "./stream-reducer";

interface ActiveConversationState {
    conversationId: string | null;
    items: AgentItem[];
    streaming: boolean;
    hasMore: boolean;
    open: (conversationId: string) => Promise<void>;
    loadMore: () => Promise<void>;
    send: (providerId: string, model: string, content: string) => Promise<void>;
    abort: () => Promise<void>;
}

interface Turn {
    controller: AbortController;
    messageId: string | null;
    userAborted: boolean;
}

let turn: Turn | null = null;
let loadingMore = false;

const PAGE_SIZE = 50;
const MAX_RESUME = 3;

async function latestPage(
    conversationId: string,
): Promise<Pick<ActiveConversationState, "items" | "hasMore">> {
    const res = await conversationClient.listMessages({
        conversationId,
        limit: PAGE_SIZE,
    });
    return {
        items: hydrateToolResults(res.messages.map(protoToItem).toReversed()),
        hasMore: res.hasMore,
    };
}

export const useActiveConversation = create<ActiveConversationState>()(
    (set, get) => ({
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
            if (
                loadingMore ||
                conversationId === null ||
                !hasMore ||
                first === undefined
            ) {
                return;
            }
            loadingMore = true;
            try {
                const res = await conversationClient.listMessages({
                    conversationId,
                    beforeId: first.id,
                    limit: PAGE_SIZE,
                });
                const older = res.messages.map(protoToItem).toReversed();
                set((s) => {
                    if (
                        s.conversationId !== conversationId ||
                        s.items.at(0)?.id !== first.id
                    ) {
                        return {};
                    }
                    return {
                        items: hydrateToolResults([...older, ...s.items]),
                        hasMore: res.hasMore,
                    };
                });
            } finally {
                loadingMore = false;
            }
        },

        send: async (providerId, model, content) => {
            const { conversationId, streaming } = get();
            if (conversationId === null || streaming) {
                return;
            }

            const clientMsgId = crypto.randomUUID();
            const aiTempId = `${clientMsgId}:ai`;
            const own: Turn = {
                controller: new AbortController(),
                messageId: null,
                userAborted: false,
            };
            turn = own;
            const { signal } = own.controller;

            const reducer = createStreamReducer(
                set,
                get,
                providerId,
                model,
                aiTempId,
                (messageId) => {
                    own.messageId = messageId;
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
                const resumeId = own.messageId;
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
                    if (own.userAborted || signal.aborted) {
                        reducer.updateCurrent({ status: "aborted" });
                        return;
                    }
                    if (errorReason(e) === ErrorReason.TURN_NOT_RUNNING) {
                        const page = await latestPage(conversationId);
                        if (turn === own) {
                            set(page);
                        }
                        return;
                    }
                    const next = resumes + 1;
                    if (own.messageId === null || next > MAX_RESUME) {
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
                if (turn === own) {
                    turn = null;
                    set({ streaming: false });
                }
            }
        },

        abort: async () => {
            const current = turn;
            if (current === null) {
                return;
            }
            current.userAborted = true;
            if (current.messageId !== null) {
                await agentClient
                    .abortMessage({ messageId: current.messageId })
                    .catch(() => {});
            }
            current.controller.abort();
        },
    }),
);

/** Stops the running stream on this client and empties the open conversation; the stopped send leaves the new state alone. */
export function clearActiveConversation(): void {
    turn?.controller.abort();
    turn = null;
    useActiveConversation.setState(useActiveConversation.getInitialState());
}
