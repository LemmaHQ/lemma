import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/clients", () => ({
    chatClient: {
        sendMessage: vi.fn(),
        resumeStream: vi.fn(),
        abortMessage: vi.fn(),
    },
    conversationClient: {
        listMessages: vi.fn(),
    },
}));

import type {
    ChatEvent,
    ResumeStreamResponse,
    SendMessageResponse,
} from "@/gen/lemma/v1/chat_pb";
import { MessageStatus } from "@/gen/lemma/v1/conversation_pb";
import { chatClient, conversationClient } from "@/lib/clients";
import { closeDb, openDb, upsertMessages } from "@/lib/db";
import { useChat } from "./chat";

const sendMessage = vi.mocked(chatClient.sendMessage);
const resumeStream = vi.mocked(chatClient.resumeStream);
const abortMessage = vi.mocked(chatClient.abortMessage);
const listMessages = vi.mocked(conversationClient.listMessages);

function ev<T>(kind: ChatEvent["kind"]): T {
    return { event: { kind } } as unknown as T;
}

const started = (messageId: string): SendMessageResponse =>
    ev({ case: "started", value: { messageId, clientMsgId: "" } as never });
const delta = (content: string): SendMessageResponse =>
    ev({ case: "delta", value: { content } as never });
const done: SendMessageResponse = ev({ case: "done", value: {} as never });

// An async iterable that rejects on the first read, like a stream whose
// connection drops before any event arrives.
function throwStream(err: Error): AsyncIterable<never> {
    return {
        [Symbol.asyncIterator]() {
            return { next: () => Promise.reject(err) };
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    closeDb();
    useChat.setState({
        conversationId: "conv-1",
        items: [],
        streaming: false,
        hasMore: false,
    });
});

it("processes send stream through started, delta, and done", async () => {
    sendMessage.mockImplementation(async function* () {
        yield started("m1");
        yield delta("你");
        yield delta("好");
        yield done;
    });

    await useChat.getState().send("p1", "gpt-x", "你好");

    const { items, streaming } = useChat.getState();
    expect(streaming).toBe(false);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
        role: "user",
        content: "你好",
        status: "done",
    });
    expect(items[1]).toMatchObject({
        role: "assistant",
        content: "你好",
        status: "done",
    });
});

it("resumes after disconnect with offset matching received characters", async () => {
    sendMessage.mockImplementationOnce(async function* () {
        yield started("m1");
        yield delta("你");
        throw new Error("network down");
    });
    resumeStream.mockImplementationOnce(async function* () {
        yield delta("好") as unknown as ResumeStreamResponse;
        yield done as unknown as ResumeStreamResponse;
    });

    await useChat.getState().send("p1", "gpt-x", "你好");

    expect(resumeStream).toHaveBeenCalledWith(
        { messageId: "m1", offset: 1n },
        expect.anything(),
    );
    const { items } = useChat.getState();
    expect(items[1]).toMatchObject({ content: "你好", status: "done" });
});

it("notifies server on abort and marks message as aborted", async () => {
    sendMessage.mockImplementation(async function* (_req, opts) {
        yield started("m1");
        yield delta("半");
        await new Promise((_, reject) => {
            opts?.signal?.addEventListener("abort", () =>
                reject(new Error("aborted")),
            );
        });
    });
    abortMessage.mockResolvedValue({} as never);

    const p = useChat.getState().send("p1", "gpt-x", "你好");
    await vi.waitFor(() => {
        expect(useChat.getState().items[1]?.content).toBe("半");
    });

    await useChat.getState().abort();
    await p;

    expect(abortMessage).toHaveBeenCalledWith({ messageId: "m1" });
    expect(useChat.getState().items[1].status).toBe("aborted");
    expect(useChat.getState().streaming).toBe(false);
});

it("loads history on open and sorts in chronological order", async () => {
    listMessages.mockResolvedValue({
        messages: [
            {
                id: "m2",
                role: "assistant",
                content: "答",
                status: MessageStatus.DONE,
                providerId: "p1",
                model: "gpt-x",
            },
            {
                id: "m1",
                role: "user",
                content: "问",
                status: MessageStatus.DONE,
            },
        ],
        hasMore: false,
    } as never);

    await useChat.getState().open("conv-1");

    const { items } = useChat.getState();
    expect(items.map((i) => i.id)).toEqual(["m1", "m2"]);
    expect(items[1]).toMatchObject({
        content: "答",
        status: "done",
        model: "gpt-x",
    });
});

it("prefers local cache on open", async () => {
    const db = openDb("chat-cache-test");
    await db.delete();
    await db.open();
    await upsertMessages(db, [
        {
            id: "m1",
            conversationId: "conv-1",
            role: "user",
            content: "hi",
            providerId: "",
            model: "",
            status: MessageStatus.DONE,
            createdAtMs: 1,
            seq: 1,
            syncSeq: "1",
        },
    ]);

    await useChat.getState().open("conv-1");

    const { items, hasMore } = useChat.getState();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "m1", content: "hi", status: "done" });
    expect(hasMore).toBe(false);
    expect(listMessages).not.toHaveBeenCalled();
    closeDb();
});

it("maps streaming, aborted, and error statuses on open", async () => {
    const msg = (id: string, status: MessageStatus) => ({
        id,
        role: "assistant",
        content: id,
        status,
        providerId: "p1",
        model: "gpt-x",
    });
    listMessages.mockResolvedValue({
        // Server pages come newest-first; open reverses them.
        messages: [
            msg("m3", MessageStatus.ERROR),
            msg("m2", MessageStatus.ABORTED),
            msg("m1", MessageStatus.STREAMING),
        ],
        hasMore: false,
    } as never);

    await useChat.getState().open("conv-1");

    expect(useChat.getState().items.map((i) => i.status)).toEqual([
        "streaming",
        "aborted",
        "error",
    ]);
});

it("refreshes from cache on syncFromCache when not streaming", async () => {
    const db = openDb("chat-cache-test");
    await db.delete();
    await db.open();
    await upsertMessages(db, [
        {
            id: "m1",
            conversationId: "conv-1",
            role: "user",
            content: "cached",
            providerId: "",
            model: "",
            status: MessageStatus.DONE,
            createdAtMs: 1,
            seq: 1,
            syncSeq: "1",
        },
    ]);
    useChat.setState({
        items: [
            {
                id: "stale",
                role: "user",
                content: "",
                status: "done",
                providerId: "",
                model: "",
            },
        ],
    });

    await useChat.getState().syncFromCache();

    expect(useChat.getState().items.map((i) => i.id)).toEqual(["m1"]);
    closeDb();
});

it("preserves optimistic item during active streaming in syncFromCache", async () => {
    useChat.setState({
        streaming: true,
        items: [
            {
                id: "live",
                role: "assistant",
                content: "半",
                status: "streaming",
                providerId: "p1",
                model: "gpt-x",
            },
        ],
    });

    await useChat.getState().syncFromCache();

    expect(useChat.getState().items.map((i) => i.id)).toEqual(["live"]);
});

it("prepends earlier page on loadMore", async () => {
    useChat.setState({
        hasMore: true,
        items: [
            {
                id: "m2",
                role: "user",
                content: "二",
                status: "done",
                providerId: "",
                model: "",
            },
        ],
    });
    listMessages.mockResolvedValue({
        messages: [
            {
                id: "m1",
                role: "user",
                content: "一",
                status: MessageStatus.DONE,
                providerId: "",
                model: "",
            },
        ],
        hasMore: false,
    } as never);

    await useChat.getState().loadMore();

    const s = useChat.getState();
    expect(s.items.map((i) => i.id)).toEqual(["m1", "m2"]);
    expect(s.hasMore).toBe(false);
    expect(listMessages).toHaveBeenCalledWith({
        conversationId: "conv-1",
        beforeId: "m2",
        limit: 50,
    });
});

it("returns immediately from loadMore when hasMore is false", async () => {
    await useChat.getState().loadMore();

    expect(listMessages).not.toHaveBeenCalled();
});

it("returns immediately from send while streaming or without conversation", async () => {
    useChat.setState({ streaming: true });
    await useChat.getState().send("p1", "gpt-x", "你好");
    useChat.setState({ streaming: false, conversationId: null });
    await useChat.getState().send("p1", "gpt-x", "你好");

    expect(sendMessage).not.toHaveBeenCalled();
    expect(useChat.getState().items).toHaveLength(0);
});

it("marks aborted on aborted event", async () => {
    sendMessage.mockImplementation(async function* () {
        yield started("m1");
        yield ev({ case: "aborted", value: {} as never });
    });

    await useChat.getState().send("p1", "gpt-x", "你好");

    expect(useChat.getState().items[1].status).toBe("aborted");
});

it("surfaces error message on error event", async () => {
    sendMessage.mockImplementation(async function* () {
        yield started("m1");
        yield ev({
            case: "error",
            value: { message: "model exploded" } as never,
        });
    });

    await useChat.getState().send("p1", "gpt-x", "你好");

    const item = useChat.getState().items[1];
    expect(item.status).toBe("error");
    expect(item.error).toBe("model exploded");
});

it("ignores event without kind", async () => {
    sendMessage.mockImplementation(async function* () {
        yield started("m1");
        yield { event: {} } as unknown as SendMessageResponse;
        yield done;
    });

    await useChat.getState().send("p1", "gpt-x", "你好");

    expect(useChat.getState().items[1].status).toBe("done");
});

it("does not retry on initial failure and marks error", async () => {
    sendMessage.mockImplementation(
        () => throwStream(new Error("boom")) as never,
    );

    await useChat.getState().send("p1", "gpt-x", "你好");

    expect(resumeStream).not.toHaveBeenCalled();
    const item = useChat.getState().items[1];
    expect(item.status).toBe("error");
    expect(item.error).toContain("boom");
});

it("abandons retry after three failed resume attempts", async () => {
    vi.useFakeTimers();
    try {
        sendMessage.mockImplementation(async function* () {
            yield started("m1");
            yield delta("半");
            throw new Error("down");
        });
        resumeStream.mockImplementation(
            () => throwStream(new Error("down")) as never,
        );

        const p = useChat.getState().send("p1", "gpt-x", "你好");
        await vi.runAllTimersAsync();
        await p;
    } finally {
        vi.useRealTimers();
    }

    expect(resumeStream).toHaveBeenCalledTimes(3);
    expect(useChat.getState().items[1].status).toBe("error");
});
