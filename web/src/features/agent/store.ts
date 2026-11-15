import { create } from "zustand";
import {
    markSessionSeen,
    markSessionTurnFinished,
    setSessionActiveTurn,
} from "@/features/session";
import { i18n } from "@/i18n";
import { errorText } from "@/i18n/error-text";
import { agentClient, sessionClient } from "@/rpc/clients";
import {
    EMPTY_SESSION_SLICE,
    nonEmptyId,
    resolveActivePath,
    type TurnStoreSlice,
} from "./active-path";
import { createActiveTurnRunner } from "./active-turn";
import { hydrateToolResults, protoToItem } from "./agent-item";

/** Pending rewind state while editing/branching from an earlier user question. */
export interface RewindState {
    backupLeafId: string | undefined;
    parentId: string | undefined;
    previousDraft: string;
}

export interface ActiveSessionState extends TurnStoreSlice {
    sessionId: string | null;
    loadedSessionId: string | null;
    rewind: RewindState | null;
    drafts: Record<string, string>;
    setDraft: (sessionKey: string, text: string) => void;
    clearDraft: (sessionKey: string) => void;
    beginCreatedSession: (sessionId: string) => void;
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
    reset: () => void;
}

function setDraftEntry(
    drafts: Record<string, string>,
    key: string,
    text: string,
): Record<string, string> {
    if (text !== "") {
        return { ...drafts, [key]: text };
    }
    const { [key]: _removed, ...rest } = drafts;
    return key in drafts ? rest : drafts;
}

export const useActiveSessionStore = create<ActiveSessionState>()((
    set,
    get,
) => {
    const hydrateSession = async (
        sessionId: string,
        isCurrent?: () => boolean,
    ) => {
        const res = await sessionClient.listMessages({ sessionId });
        if (
            (isCurrent !== undefined && !isCurrent()) ||
            get().sessionId !== sessionId
        ) {
            return null;
        }
        const treeMessages = hydrateToolResults(res.messages.map(protoToItem));
        const leafId = nonEmptyId(res.leafId);
        const items = resolveActivePath(treeMessages, leafId);
        if (isCurrent !== undefined) {
            set({ treeMessages, leafId, items });
            return null;
        }
        const activeMessageId = nonEmptyId(res.activeMessageId);
        setSessionActiveTurn(sessionId, activeMessageId);
        if (activeMessageId !== undefined) {
            return { treeMessages, activeMessageId };
        }
        set({
            sessionId,
            loadedSessionId: sessionId,
            treeMessages,
            leafId,
            items,
            rewind: null,
        });
        return null;
    };

    const runner = createActiveTurnRunner({
        getSlice: () => get(),
        patchStore: (p) => set(typeof p === "function" ? (s) => p(s) : p),
        sendMessage: ({ parentId, ...req }, signal) =>
            agentClient.sendMessage(
                parentId === undefined ? req : { ...req, parentId },
                { signal },
            ),
        resumeStream: (messageId, offset, signal) =>
            agentClient.resumeStream({ messageId, offset }, { signal }),
        abortMessage: (messageId) => agentClient.abortMessage({ messageId }),
        reload: async (sessionId, isCurrent) => {
            await hydrateSession(sessionId, isCurrent);
        },
        failedText: (cause) => errorText(cause, i18n.t),
        onUserMessageStarted: setSessionActiveTurn,
        onTurnOutcome: (sessionId, status) => {
            if (status === "aborted") {
                setSessionActiveTurn(sessionId, undefined);
            } else {
                markSessionTurnFinished(
                    sessionId,
                    status,
                    get().sessionId === sessionId,
                );
            }
        },
    });

    return {
        sessionId: null,
        loadedSessionId: null,
        drafts: {},
        ...EMPTY_SESSION_SLICE,
        setDraft: (key, text) =>
            set((s) => ({ drafts: setDraftEntry(s.drafts, key, text) })),
        clearDraft: (key) =>
            set((s) => ({ drafts: setDraftEntry(s.drafts, key, "") })),
        beginCreatedSession: (sessionId) => {
            runner.cancel();
            set((s) => ({
                sessionId,
                loadedSessionId: sessionId,
                drafts: setDraftEntry(s.drafts, "", ""),
                ...EMPTY_SESSION_SLICE,
            }));
        },
        open: async (sessionId) => {
            markSessionSeen(sessionId);
            if (get().sessionId === sessionId) {
                set({ loadedSessionId: sessionId });
            } else {
                runner.cancel();
                set({
                    sessionId,
                    loadedSessionId: sessionId,
                    ...EMPTY_SESSION_SLICE,
                });
            }
            const active = await hydrateSession(sessionId);
            if (
                active !== null &&
                !runner.isCurrentMessage(active.activeMessageId)
            ) {
                await runner.resume({ sessionId, ...active });
            }
        },
        send: async (providerId, model, content, explicitParentId) => {
            const { sessionId, streaming, rewind, leafId, treeMessages } =
                get();
            if (sessionId === null || streaming) {
                return;
            }
            const hasExplicitParent =
                explicitParentId !== undefined || rewind !== null;
            const requestParentId = hasExplicitParent
                ? (explicitParentId ?? rewind?.parentId ?? "")
                : undefined;
            const targetParentId =
                explicitParentId === undefined
                    ? rewind === null
                        ? leafId
                        : rewind.parentId
                    : nonEmptyId(explicitParentId);
            set((s) => ({
                drafts: setDraftEntry(s.drafts, sessionId, ""),
            }));
            await runner.send({
                sessionId,
                treeMessages,
                targetParentId,
                requestParentId,
                providerId,
                model,
                content,
            });
        },
        abort: () => runner.abort(),
        switchLeaf: async (leafId) => {
            const { sessionId, streaming } = get();
            if (sessionId === null || streaming) {
                return;
            }
            await sessionClient.setSessionLeaf({
                sessionId,
                ...(leafId === undefined ? {} : { leafId }),
            });
            if (get().sessionId === sessionId) {
                set((s) => ({
                    leafId,
                    items: resolveActivePath(s.treeMessages, leafId),
                    rewind: null,
                }));
            }
        },
        startRewind: (userMessageId) => {
            const { sessionId, streaming, treeMessages, rewind, leafId } =
                get();
            if (sessionId === null || streaming) {
                return;
            }
            const user = treeMessages.find(
                (m) => m.id === userMessageId && m.role === "user",
            );
            if (user === undefined) {
                return;
            }
            set((s) => ({
                rewind: {
                    backupLeafId:
                        rewind === null ? leafId : rewind.backupLeafId,
                    parentId: user.parentId,
                    previousDraft:
                        rewind === null
                            ? (s.drafts[sessionId] ?? "")
                            : rewind.previousDraft,
                },
                leafId: user.parentId,
                items: resolveActivePath(treeMessages, user.parentId),
                drafts: setDraftEntry(s.drafts, sessionId, user.content),
            }));
        },
        cancelRewind: () => {
            const { sessionId, rewind, treeMessages } = get();
            if (sessionId === null || rewind === null) {
                return;
            }
            set((s) => ({
                leafId: rewind.backupLeafId,
                items: resolveActivePath(treeMessages, rewind.backupLeafId),
                rewind: null,
                drafts: setDraftEntry(
                    s.drafts,
                    sessionId,
                    rewind.previousDraft,
                ),
            }));
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
            const next = nonEmptyId(
                res.message === undefined ? label : res.message.label,
            );
            set((s) => {
                const treeMessages = s.treeMessages.map((m) =>
                    m.id === messageId ? { ...m, label: next } : m,
                );
                return {
                    treeMessages,
                    items: resolveActivePath(treeMessages, s.leafId),
                };
            });
        },
        reset: () => {
            runner.cancel();
            set(useActiveSessionStore.getInitialState(), true);
        },
    };
});

/** Clears any unsent in-memory draft stored for `sessionId`. */
export function clearSessionDraft(sessionId: string): void {
    useActiveSessionStore.getState().clearDraft(sessionId);
}

/** Prepares the active-session store synchronously for a newly created empty session before route navigation. */
export function beginCreatedSession(sessionId: string): void {
    useActiveSessionStore.getState().beginCreatedSession(sessionId);
}
