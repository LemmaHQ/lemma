import { create } from "zustand";

import { i18n } from "@/i18n";
import { errorText } from "@/i18n/error-text";
import { agentClient, sessionClient } from "@/rpc/clients";

import { type AgentItem, hydrateToolResults, protoToItem } from "./agent-item";
import type { LiveStep } from "./stream-reducer";
import { resolveActivePath } from "./tree";
import {
    EMPTY_SESSION_SLICE,
    nonEmptyId,
    type PreparedTurn,
    prepareNewTurn,
    prepareResumedTurn,
} from "./turn-prep";
import { runSessionTurn, type Turn } from "./turn-stream";

/** Pending rewind state while editing/branching from an earlier user question. */
export interface RewindState {
    backupLeafId: string | undefined;
    parentId: string | undefined;
    draftText: string;
}

interface ActiveSessionState {
    sessionId: string | null;
    treeMessages: AgentItem[];
    leafId: string | undefined;
    items: AgentItem[];
    streaming: boolean;
    turnStartedAtMs: number | null;
    currentStep: LiveStep;
    reconnectingOffset: number | null;
    rewind: RewindState | null;
    open: (sessionId: string) => Promise<void>;
    send: (
        providerId: string,
        model: string,
        content: string,
        explicitParentId?: string,
    ) => Promise<void>;
    abort: () => Promise<void>;
    switchLeaf: (leafId: string | undefined) => Promise<void>;
    startRewind: (userMessageId: string) => void;
    cancelRewind: () => void;
    labelMessage: (messageId: string, label: string) => Promise<void>;
}

let turn: Turn | null = null;

export const useActiveSession = create<ActiveSessionState>()((set, get) => {
    const launchTurn = async (
        sessionId: string,
        own: Turn,
        prepared: PreparedTurn,
        openStream: Parameters<typeof runSessionTurn>[0]["openStream"],
    ) => {
        turn = own;
        set({ ...prepared.patch, rewind: null });
        await runSessionTurn({
            own,
            prepared,
            isCurrent: () => turn === own,
            getSlice: () => get(),
            patchStore: (fn) => set((s) => fn(s)),
            openStream,
            reload: async () => {
                const res = await sessionClient.listMessages({ sessionId });
                if (turn !== own || get().sessionId !== sessionId) {
                    return;
                }
                const treeMessages = hydrateToolResults(
                    res.messages.map(protoToItem),
                );
                const leafId = nonEmptyId(res.leafId);
                set({
                    treeMessages,
                    leafId,
                    items: resolveActivePath(treeMessages, leafId),
                });
            },
            failedText: (e) => errorText(e, i18n.t),
            onSettled: () => {
                turn = null;
            },
        });
    };

    return {
        sessionId: null,
        ...EMPTY_SESSION_SLICE,

        open: async (sessionId) => {
            if (get().sessionId !== sessionId) {
                turn?.controller.abort();
                turn = null;
                set({ sessionId, ...EMPTY_SESSION_SLICE });
            }
            const res = await sessionClient.listMessages({ sessionId });
            if (get().sessionId !== sessionId) {
                return;
            }
            const treeMessages = hydrateToolResults(
                res.messages.map(protoToItem),
            );
            const leafId = nonEmptyId(res.leafId);
            const activeMessageId = nonEmptyId(res.activeMessageId);
            if (activeMessageId === undefined) {
                set({
                    sessionId,
                    treeMessages,
                    leafId,
                    items: resolveActivePath(treeMessages, leafId),
                    rewind: null,
                });
                return;
            }
            if (turn?.messageId === activeMessageId) {
                return;
            }
            const prepared = prepareResumedTurn(treeMessages, activeMessageId);
            await launchTurn(
                sessionId,
                {
                    controller: new AbortController(),
                    messageId: activeMessageId,
                    userAborted: false,
                },
                prepared,
                (received, signal) =>
                    agentClient.resumeStream(
                        {
                            messageId: activeMessageId,
                            offset: BigInt(received),
                        },
                        { signal },
                    ),
            );
        },

        send: async (providerId, model, content, explicitParentId) => {
            const { sessionId, streaming, rewind, leafId, treeMessages } =
                get();
            if (sessionId === null || streaming) {
                return;
            }
            const hasExplicitParent =
                explicitParentId !== undefined || rewind !== null;
            const requestParentId = explicitParentId ?? rewind?.parentId ?? "";
            const targetParentId =
                explicitParentId === undefined
                    ? rewind === null
                        ? leafId
                        : rewind.parentId
                    : nonEmptyId(explicitParentId);
            const prepared = prepareNewTurn(
                treeMessages,
                targetParentId,
                providerId,
                model,
                content,
            );
            const own: Turn = {
                controller: new AbortController(),
                messageId: null,
                userAborted: false,
            };
            await launchTurn(sessionId, own, prepared, (received, signal) => {
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
                        ...(hasExplicitParent
                            ? { parentId: requestParentId }
                            : {}),
                    },
                    { signal },
                );
            });
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

        switchLeaf: async (leafId) => {
            const { sessionId } = get();
            if (sessionId === null) {
                return;
            }
            await sessionClient.setSessionLeaf({
                sessionId,
                ...(leafId === undefined ? {} : { leafId }),
            });
            if (get().sessionId !== sessionId) {
                return;
            }
            set((s) => ({
                leafId,
                items: resolveActivePath(s.treeMessages, leafId),
                rewind: null,
            }));
        },

        startRewind: (userMessageId) => {
            const { streaming, treeMessages, rewind, leafId } = get();
            if (streaming) {
                return;
            }
            const userMessage = treeMessages.find(
                (item) => item.id === userMessageId && item.role === "user",
            );
            if (userMessage === undefined) {
                return;
            }
            set({
                rewind: {
                    backupLeafId:
                        rewind === null ? leafId : rewind.backupLeafId,
                    parentId: userMessage.parentId,
                    draftText: userMessage.content,
                },
                leafId: userMessage.parentId,
                items: resolveActivePath(treeMessages, userMessage.parentId),
            });
        },

        cancelRewind: () => {
            const { rewind, treeMessages } = get();
            if (rewind === null) {
                return;
            }
            set({
                leafId: rewind.backupLeafId,
                items: resolveActivePath(treeMessages, rewind.backupLeafId),
                rewind: null,
            });
        },

        labelMessage: async (messageId, label) => {
            const { sessionId } = get();
            if (sessionId === null) {
                return;
            }
            const res = await sessionClient.setMessageLabel({
                sessionId,
                messageId,
                label,
            });
            if (get().sessionId !== sessionId) {
                return;
            }
            const nextLabel = nonEmptyId(
                res.message === undefined ? label : res.message.label,
            );
            set((s) => {
                const treeMessages = s.treeMessages.map((item) =>
                    item.id === messageId
                        ? { ...item, label: nextLabel }
                        : item,
                );
                return {
                    treeMessages,
                    items: resolveActivePath(treeMessages, s.leafId),
                };
            });
        },
    };
});
