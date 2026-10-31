import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { beforeEach, expect, it, vi } from "vitest";

import {
    type Conversation,
    ConversationSchema,
} from "@/gen/lemma/v1/conversation_pb";

import { useConversationsStore } from "./store";
import {
    clearConversations,
    createConversation,
    refreshConversations,
} from "./useConversations";

type Reply = { conversation?: Conversation | undefined };

const rpc = vi.hoisted(() => ({
    listConversations:
        vi.fn<(req: object) => Promise<{ conversations: Conversation[] }>>(),
    createConversation: vi.fn<(req: object) => Promise<Reply>>(),
    renameConversation:
        vi.fn<(req: { id: string; title: string }) => Promise<Reply>>(),
    deleteConversation: vi.fn<(req: { id: string }) => Promise<object>>(),
}));

vi.mock("@/rpc/clients", () => ({ conversationClient: rpc }));

const conversation = (id: string, title: string, updatedMs?: number) =>
    create(ConversationSchema, {
        id,
        title,
        ...(updatedMs === undefined
            ? {}
            : { updatedAt: timestampFromDate(new Date(updatedMs)) }),
    });

const list = () => useConversationsStore.getState().list;

beforeEach(async () => {
    vi.resetAllMocks();
    clearConversations();
    rpc.listConversations.mockResolvedValue({
        conversations: [
            conversation("c1", "First", 5000),
            conversation("c2", ""),
        ],
    });
    await refreshConversations();
});

it("loads the list with update times, zero when unknown", () => {
    expect(useConversationsStore.getState().loaded).toBe(true);
    expect(list()).toEqual([
        { id: "c1", title: "First", updatedAtMs: 5000 },
        { id: "c2", title: "", updatedAtMs: 0 },
    ]);
});

it("puts a created conversation first", async () => {
    rpc.createConversation.mockResolvedValue({
        conversation: conversation("c3", "", 9000),
    });

    await expect(createConversation()).resolves.toBe("c3");
    expect(list().map((c) => c.id)).toEqual(["c3", "c1", "c2"]);
});

it("fails a create the server answers without a conversation", async () => {
    rpc.createConversation.mockResolvedValue({});

    await expect(createConversation()).rejects.toThrow(
        "no conversation in response",
    );
    expect(list()).toHaveLength(2);
});

it("replaces a renamed conversation in place", async () => {
    rpc.renameConversation.mockResolvedValue({
        conversation: conversation("c2", "Second", 7000),
    });

    await useConversationsStore.getState().rename("c2", "Second");

    expect(rpc.renameConversation).toHaveBeenCalledWith({
        id: "c2",
        title: "Second",
    });
    expect(list()[1]).toEqual({ id: "c2", title: "Second", updatedAtMs: 7000 });
});

it("keeps the list when a rename returns no conversation", async () => {
    rpc.renameConversation.mockResolvedValue({});

    await useConversationsStore.getState().rename("c2", "Second");

    expect(list()[1]?.title).toBe("");
});

it("removes a deleted conversation", async () => {
    rpc.deleteConversation.mockResolvedValue({});

    await useConversationsStore.getState().delete("c1");

    expect(rpc.deleteConversation).toHaveBeenCalledWith({ id: "c1" });
    expect(list().map((c) => c.id)).toEqual(["c2"]);
});
