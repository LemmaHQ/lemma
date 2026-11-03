import { create } from "zustand";

import { agentClient, sessionClient } from "@/rpc/clients";
import { errorReason } from "@/rpc/errors";
import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";
import { ErrorReason } from "@/gen/lemma/v1/errors_pb";
import { i18n } from "@/i18n";
import { errorText } from "@/i18n/error-text";

import { type AgentItem, hydrateToolResults, protoToItem } from "./agent-item";
import { createStreamReducer } from "./stream-reducer";

interface ActiveSessionState {
    sessionId: string | null;
    items: AgentItem[];
    streaming: boolean;
    hasMore: boolean;
    open: (sessionId: string) => Promise<void>;
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
    sessionId: string,
): Promise<Pick<ActiveSessionState, "items" | "hasMore">> {
    const res = await sessionClient.listMessages({
        sessionId,
        limit: PAGE_SIZE,
    });
    return {
        items: hydrateToolResults(res.messages.map(protoToItem).toReversed()),
        hasMore: res.hasMore,
    };
}

export const useActiveSession = create<ActiveSessionState>()((set, get) => ({
    sessionId: null,
    items: [],
    streaming: false,
    hasMore: false,

    open: async (sessionId) => {
        set({ sessionId, ...(await latestPage(sessionId)) });
    },

    loadMore: async () => {
        const { sessionId, items, hasMore } = get();
        const first = items.at(0);
        if (
            loadingMore ||
            sessionId === null ||
            !hasMore ||
            first === undefined
        ) {
            return;
        }
        loadingMore = true;
        try {
            const res = await sessionClient.listMessages({
                sessionId,
                beforeId: first.id,
                limit: PAGE_SIZE,
            });
            const older = res.messages.map(protoToItem).toReversed();
            set((s) => {
                if (
                    s.sessionId !== sessionId ||
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
        const { sessionId, streaming } = get();
        if (sessionId === null || streaming) {
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
                    sessionId,
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
                    const page = await latestPage(sessionId);
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
}));

/** Stops the running stream on this client and empties the open session; the stopped send leaves the new state alone. */
export function clearActiveSession(): void {
    turn?.controller.abort();
    turn = null;
    useActiveSession.setState(useActiveSession.getInitialState());
}
