import { timestampDate } from "@bufbuild/protobuf/wkt";
import { create } from "zustand";

import type { Session } from "@/gen/lemma/v1/session_pb";
import { sessionClient } from "@/rpc/clients";

import type { SessionSummary } from "./grouping";

interface SessionState {
    list: SessionSummary[];
    loaded: boolean;
    unseenDoneIds: Set<string>;
    erroredIds: Set<string>;
    refresh: () => Promise<void>;
    create: (directory?: string) => Promise<string>;
    rename: (id: string, title: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
    markTurnFinished: (
        id: string,
        status: "done" | "error",
        isViewing: boolean,
    ) => void;
    markSeen: (id: string) => void;
    setActiveTurn: (id: string, activeMessageId: string | undefined) => void;
    setLeaf: (
        sessionId: string,
        leafId?: string,
    ) => Promise<SessionSummary | undefined>;
    setMessageLabel: (
        sessionId: string,
        messageId: string,
        label: string,
    ) => Promise<string | undefined>;
}

export const useSessionStore = create<SessionState>()((set) => ({
    list: [],
    loaded: false,
    unseenDoneIds: new Set(),
    erroredIds: new Set(),

    refresh: async () => {
        const res = await sessionClient.listSessions({});
        set({ list: res.sessions.map(toSummary), loaded: true });
    },

    create: async (directory) => {
        const res = await sessionClient.createSession(
            directory === undefined ? {} : { directory },
        );
        if (res.session === undefined) {
            throw new Error("no session in response");
        }
        const session = toSummary(res.session);
        set((s) => ({ list: [session, ...s.list] }));
        return session.id;
    },

    rename: async (id, title) => {
        const res = await sessionClient.renameSession({
            id,
            title,
        });
        if (res.session === undefined) {
            return;
        }
        const session = toSummary(res.session);
        set((s) => ({
            list: s.list.map((c) => (c.id === id ? session : c)),
        }));
    },

    delete: async (id) => {
        await sessionClient.deleteSession({ id });
        set((s) => ({
            list: s.list.filter((c) => c.id !== id),
            unseenDoneIds: withoutId(s.unseenDoneIds, id),
            erroredIds: withoutId(s.erroredIds, id),
        }));
    },

    markTurnFinished: (id, status, isViewing) => {
        set((s) => ({
            list: s.list.map((c) => (c.id === id ? clearActiveMessage(c) : c)),
            erroredIds:
                status === "error"
                    ? withId(s.erroredIds, id)
                    : withoutId(s.erroredIds, id),
            unseenDoneIds:
                status === "done" && !isViewing
                    ? withId(s.unseenDoneIds, id)
                    : withoutId(s.unseenDoneIds, id),
        }));
    },

    markSeen: (id) => {
        set((s) => ({
            unseenDoneIds: withoutId(s.unseenDoneIds, id),
            erroredIds: withoutId(s.erroredIds, id),
        }));
    },

    setActiveTurn: (id, activeMessageId) => {
        set((s) => ({
            list: s.list.map((c) =>
                c.id === id
                    ? activeMessageId === undefined
                        ? clearActiveMessage(c)
                        : { ...c, activeMessageId }
                    : c,
            ),
            ...(activeMessageId === undefined
                ? {}
                : {
                      unseenDoneIds: withoutId(s.unseenDoneIds, id),
                      erroredIds: withoutId(s.erroredIds, id),
                  }),
        }));
    },

    setLeaf: async (sessionId, leafId) => {
        const res = await sessionClient.setSessionLeaf({
            sessionId,
            ...(leafId === undefined ? {} : { leafId }),
        });
        if (res.session === undefined) {
            return;
        }
        const session = toSummary(res.session);
        set((s) => ({
            list: s.list.map((c) => (c.id === sessionId ? session : c)),
        }));
        return session;
    },

    setMessageLabel: async (sessionId, messageId, label) => {
        const res = await sessionClient.setMessageLabel({
            sessionId,
            messageId,
            label,
        });
        return res.message?.label;
    },
}));

function withoutId(set: Set<string>, id: string): Set<string> {
    if (!set.has(id)) {
        return set;
    }
    const next = new Set(set);
    next.delete(id);
    return next;
}

function withId(set: Set<string>, id: string): Set<string> {
    return set.has(id) ? set : new Set([...set, id]);
}

function clearActiveMessage(session: SessionSummary): SessionSummary {
    const { activeMessageId: _, ...rest } = session;
    return rest;
}

function toSummary(c: Session): SessionSummary {
    return {
        id: c.id,
        title: c.title,
        updatedAtMs:
            c.updatedAt === undefined
                ? 0
                : timestampDate(c.updatedAt).getTime(),
        ...(c.directory === undefined ? {} : { directory: c.directory }),
        ...(c.leafId === undefined ? {} : { leafId: c.leafId }),
        ...(c.activeMessageId === undefined
            ? {}
            : { activeMessageId: c.activeMessageId }),
    };
}
