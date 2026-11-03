import { timestampDate } from "@bufbuild/protobuf/wkt";
import { create } from "zustand";

import { sessionClient } from "@/rpc/clients";
import type { Session } from "@/gen/lemma/v1/session_pb";

import type { SessionSummary } from "./grouping";

interface SessionState {
    list: SessionSummary[];
    loaded: boolean;
    refresh: () => Promise<void>;
    create: () => Promise<string>;
    rename: (id: string, title: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>()((set) => ({
    list: [],
    loaded: false,

    refresh: async () => {
        const res = await sessionClient.listSessions({});
        set({ list: res.sessions.map(toSummary), loaded: true });
    },

    create: async () => {
        const res = await sessionClient.createSession({});
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
        set((s) => ({ list: s.list.filter((c) => c.id !== id) }));
    },
}));

function toSummary(c: Session): SessionSummary {
    return {
        id: c.id,
        title: c.title,
        updatedAtMs:
            c.updatedAt === undefined
                ? 0
                : timestampDate(c.updatedAt).getTime(),
    };
}
