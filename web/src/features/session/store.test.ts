import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { beforeEach, expect, it, vi } from "vitest";

import { type Session, SessionSchema } from "@/gen/lemma/v1/session_pb";

import { useSessionStore } from "./store";
import { createSession, refreshSessions } from "./useSessions";

type Reply = { session?: Session | undefined };

const rpc = vi.hoisted(() => ({
    listSessions: vi.fn<(req: object) => Promise<{ sessions: Session[] }>>(),
    createSession: vi.fn<(req: object) => Promise<Reply>>(),
    renameSession:
        vi.fn<(req: { id: string; title: string }) => Promise<Reply>>(),
    deleteSession: vi.fn<(req: { id: string }) => Promise<object>>(),
}));

vi.mock("@/rpc/clients", () => ({ sessionClient: rpc }));

const session = (
    id: string,
    title: string,
    updatedMs?: number,
    directory?: string,
    extra?: { leafId?: string; activeMessageId?: string },
) =>
    create(SessionSchema, {
        id,
        title,
        ...(updatedMs === undefined
            ? {}
            : { updatedAt: timestampFromDate(new Date(updatedMs)) }),
        ...(directory === undefined ? {} : { directory }),
        ...extra,
    });

const list = () => useSessionStore.getState().list;

beforeEach(async () => {
    vi.resetAllMocks();
    useSessionStore.setState(useSessionStore.getInitialState());
    rpc.listSessions.mockResolvedValue({
        sessions: [
            session("c1", "First", 5000, "C:\\work\\first", {
                leafId: "m2",
                activeMessageId: "m3",
            }),
            session("c2", ""),
        ],
    });
    await refreshSessions();
});

it("loads the list with update times, leafId, activeMessageId, and zero when unknown", () => {
    expect(useSessionStore.getState().loaded).toBe(true);
    expect(list()).toEqual([
        {
            id: "c1",
            title: "First",
            updatedAtMs: 5000,
            directory: "C:\\work\\first",
            leafId: "m2",
            activeMessageId: "m3",
        },
        { id: "c2", title: "", updatedAtMs: 0 },
    ]);
});

it("puts a created session first", async () => {
    rpc.createSession.mockResolvedValue({
        session: session("c3", "", 9000, "C:\\work\\new"),
    });

    await expect(createSession("C:\\work\\new")).resolves.toBe("c3");
    expect(rpc.createSession).toHaveBeenCalledWith({
        directory: "C:\\work\\new",
    });
    expect(list().map((c) => c.id)).toEqual(["c3", "c1", "c2"]);
    expect(list()[0]?.directory).toBe("C:\\work\\new");
});

it("fails a create the server answers without a session", async () => {
    rpc.createSession.mockResolvedValue({});

    await expect(createSession()).rejects.toThrow("no session in response");
    expect(rpc.createSession).toHaveBeenCalledWith({});
    expect(list()).toHaveLength(2);
});

it("replaces a renamed session in place", async () => {
    rpc.renameSession.mockResolvedValue({
        session: session("c2", "Second", 7000),
    });

    await useSessionStore.getState().rename("c2", "Second");

    expect(rpc.renameSession).toHaveBeenCalledWith({
        id: "c2",
        title: "Second",
    });
    expect(list()[1]).toEqual({ id: "c2", title: "Second", updatedAtMs: 7000 });
});

it("keeps the list when a rename returns no session", async () => {
    rpc.renameSession.mockResolvedValue({});

    await useSessionStore.getState().rename("c2", "Second");

    expect(list()[1]?.title).toBe("");
});

it("removes a deleted session and clears its markers", async () => {
    rpc.deleteSession.mockResolvedValue({});
    useSessionStore.getState().markTurnFinished("c1", "done", false);

    await useSessionStore.getState().delete("c1");

    expect(rpc.deleteSession).toHaveBeenCalledWith({ id: "c1" });
    expect(list().map((c) => c.id)).toEqual(["c2"]);
    expect(useSessionStore.getState().unseenDoneIds.has("c1")).toBe(false);
});

it("tracks active turns, unseen completions, errors, and seen state", () => {
    const store = useSessionStore.getState();

    store.markTurnFinished("c2", "done", false);
    expect(useSessionStore.getState().unseenDoneIds.has("c2")).toBe(true);
    expect(useSessionStore.getState().erroredIds.has("c2")).toBe(false);

    store.markTurnFinished("c2", "done", false);
    expect(useSessionStore.getState().unseenDoneIds.has("c2")).toBe(true);

    store.setActiveTurn("c2", "m9");
    expect(list()[1]?.activeMessageId).toBe("m9");
    expect(useSessionStore.getState().unseenDoneIds.has("c2")).toBe(false);

    store.markTurnFinished("c2", "error", true);
    expect(list()[1]?.activeMessageId).toBeUndefined();
    expect(useSessionStore.getState().erroredIds.has("c2")).toBe(true);

    store.markTurnFinished("c2", "error", false);
    expect(useSessionStore.getState().erroredIds.has("c2")).toBe(true);

    store.markTurnFinished("c2", "done", true);
    expect(useSessionStore.getState().erroredIds.has("c2")).toBe(false);
    expect(useSessionStore.getState().unseenDoneIds.has("c2")).toBe(false);

    store.markTurnFinished("c1", "error", false);
    store.markSeen("c1");
    expect(useSessionStore.getState().erroredIds.has("c1")).toBe(false);

    store.setActiveTurn("c1", undefined);
    expect(list()[0]?.activeMessageId).toBeUndefined();
});

it("deduplicates concurrent refresh calls and retries cleanly after failure", async () => {
    rpc.listSessions.mockClear();
    const first = Promise.withResolvers<{ sessions: Session[] }>();
    rpc.listSessions.mockReturnValueOnce(first.promise);

    const a = refreshSessions();
    const b = refreshSessions();
    expect(a).toBe(b);
    expect(rpc.listSessions).toHaveBeenCalledTimes(1);

    first.resolve({ sessions: [session("c9", "Fresh", 9000)] });
    await Promise.all([a, b]);
    expect(list().map((c) => c.id)).toEqual(["c9"]);

    rpc.listSessions.mockRejectedValueOnce(new Error("offline"));
    await expect(refreshSessions()).rejects.toThrow("offline");

    rpc.listSessions.mockResolvedValueOnce({
        sessions: [session("c10", "Recovered", 10_000)],
    });
    await refreshSessions();
    expect(list().map((c) => c.id)).toEqual(["c10"]);
});
