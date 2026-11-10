import { create } from "zustand";

import { agentClient, sessionClient } from "@/rpc/clients";
import type { ListMessagesResponse } from "@/gen/lemma/v1/session_pb";
import { i18n } from "@/i18n";
import { errorText } from "@/i18n/error-text";

import { type AgentItem, hydrateToolResults, protoToItem } from "./agent-item";
import { createStreamReducer } from "./stream-reducer";
import { runTurn, type Turn } from "./turn-stream";

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

let turn: Turn | null = null;
let loadingMore = false;

const PAGE_SIZE = 50;

function fetchPage(
    sessionId: string,
    beforeId?: string,
): Promise<ListMessagesResponse> {
    return sessionClient.listMessages({
        sessionId,
        ...(beforeId === undefined ? {} : { beforeId }),
        limit: PAGE_SIZE,
    });
}

function pageState(
    page: ListMessagesResponse,
    newer: AgentItem[] = [],
): Pick<ActiveSessionState, "items" | "hasMore"> {
    const older = page.messages.map(protoToItem).toReversed();
    return {
        items: hydrateToolResults([...older, ...newer]),
        hasMore: page.hasMore,
    };
}

export const useActiveSession = create<ActiveSessionState>()((set, get) => ({
    sessionId: null,
    items: [],
    streaming: false,
    hasMore: false,

    open: async (sessionId) => {
        set({ sessionId, ...pageState(await fetchPage(sessionId)) });
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
            const page = await fetchPage(sessionId, first.id);
            set((s) => {
                if (
                    s.sessionId !== sessionId ||
                    s.items.at(0)?.id !== first.id
                ) {
                    return {};
                }
                return pageState(page, s.items);
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

        try {
            await runTurn(own, {
                openStream: (received) => {
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
                },
                applyEvent: reducer.applyEvent,
                updateCurrent: reducer.updateCurrent,
                reload: async () => {
                    const page = pageState(await fetchPage(sessionId));
                    if (turn === own) {
                        set(page);
                    }
                },
                failedText: (e) => errorText(e, i18n.t),
            });
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
