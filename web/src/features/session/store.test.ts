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
) =>
    create(SessionSchema, {
        id,
        title,
        ...(updatedMs === undefined
            ? {}
            : { updatedAt: timestampFromDate(new Date(updatedMs)) }),
        ...(directory === undefined ? {} : { directory }),
    });

const list = () => useSessionStore.getState().list;

beforeEach(async () => {
    vi.resetAllMocks();
    useSessionStore.setState(useSessionStore.getInitialState());
    rpc.listSessions.mockResolvedValue({
        sessions: [
            session("c1", "First", 5000, "C:\\work\\first"),
            session("c2", ""),
        ],
    });
    await refreshSessions();
});

it("loads the list with update times, zero when unknown", () => {
    expect(useSessionStore.getState().loaded).toBe(true);
    expect(list()).toEqual([
        {
            id: "c1",
            title: "First",
            updatedAtMs: 5000,
            directory: "C:\\work\\first",
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

it("removes a deleted session", async () => {
    rpc.deleteSession.mockResolvedValue({});

    await useSessionStore.getState().delete("c1");

    expect(rpc.deleteSession).toHaveBeenCalledWith({ id: "c1" });
    expect(list().map((c) => c.id)).toEqual(["c2"]);
});
