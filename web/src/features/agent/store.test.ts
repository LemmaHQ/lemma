import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AgentEvent, AgentEventSchema } from "@/gen/lemma/v1/agent_pb";
import {
    type ListMessagesResponse,
    ListMessagesResponseSchema,
    MessageStatus,
} from "@/gen/lemma/v1/conversation_pb";
import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";

import { clearActiveConversation, useActiveConversation } from "./store";

type StreamResponse = { event?: AgentEvent | undefined };
type Stream = AsyncIterable<StreamResponse>;
type EventKind = NonNullable<MessageInitShape<typeof AgentEventSchema>["kind"]>;
type MessageInit = NonNullable<
    MessageInitShape<typeof ListMessagesResponseSchema>["messages"]
>[number];

const rpc = vi.hoisted(() => ({
    listMessages:
        vi.fn<
            (req: {
                conversationId: string;
                beforeId?: string;
                limit: number;
            }) => Promise<ListMessagesResponse>
        >(),
    sendMessage: vi.fn<
        (
            req: {
                conversationId: string;
                content: string;
                providerId: string;
                model: string;
            },
            options: { signal: AbortSignal },
        ) => Stream
    >(),
    resumeStream:
        vi.fn<
            (
                req: { messageId: string; offset: bigint },
                options: { signal: AbortSignal },
            ) => Stream
        >(),
    abortMessage: vi.fn<(req: { messageId: string }) => Promise<unknown>>(),
}));

vi.mock("@/rpc/clients", () => ({
    agentClient: {
        sendMessage: rpc.sendMessage,
        resumeStream: rpc.resumeStream,
        abortMessage: rpc.abortMessage,
    },
    conversationClient: { listMessages: rpc.listMessages },
}));

const event = (kind: EventKind): StreamResponse => ({
    event: create(AgentEventSchema, { kind }),
});

const started = (messageId: string) =>
    event({ case: "started", value: { messageId } });
const turnStarted = (messageId: string) =>
    event({ case: "turnStarted", value: { messageId } });
const text = (content: string) =>
    event({
        case: "delta",
        value: { part: { case: "text", value: { content } } },
    });
const thinking = (content: string) =>
    event({
        case: "delta",
        value: { part: { case: "thinking", value: { content } } },
    });
const done = () => event({ case: "done", value: {} });

async function* stream(
    events: StreamResponse[],
    failure?: Error,
): AsyncGenerator<StreamResponse> {
    await Promise.resolve();
    yield* events;
    if (failure !== undefined) {
        throw failure;
    }
}

async function* untilAborted(
    events: StreamResponse[],
    signal: AbortSignal,
): AsyncGenerator<StreamResponse> {
    yield* stream(events);
    const aborted = Promise.withResolvers<never>();
    const reject = () => {
        aborted.reject(new ConnectError("aborted", Code.Canceled));
    };
    signal.addEventListener("abort", reject);
    if (signal.aborted) {
        reject();
    }
    await aborted.promise;
}

const page = (messages: MessageInit[], hasMore = false) =>
    create(ListMessagesResponseSchema, { messages, hasMore });

const state = () => useActiveConversation.getState();

const turnNotRunning = () =>
    new ConnectError("finished", Code.FailedPrecondition, undefined, [
        {
            desc: ErrorInfoSchema,
            value: { reason: ErrorReason.TURN_NOT_RUNNING },
        },
    ]);

beforeEach(() => {
    clearActiveConversation();
    vi.resetAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("open", () => {
    it("shows the latest page oldest first with tool results folded in", async () => {
        rpc.listMessages.mockResolvedValue(
            page(
                [
                    {
                        id: "tool-1",
                        role: "tool",
                        content: "file contents",
                        toolResult: { toolCallId: "call-1", isError: true },
                    },
                    {
                        id: "assistant-1",
                        role: "assistant",
                        status: MessageStatus.DONE,
                        toolCalls: [
                            { id: "call-1", name: "read_file" },
                            { id: "call-2", name: "bash" },
                        ],
                    },
                    { id: "user-1", role: "user", content: "read it" },
                ],
                true,
            ),
        );

        await state().open("conversation-1");

        expect(rpc.listMessages).toHaveBeenCalledWith({
            conversationId: "conversation-1",
            limit: 50,
        });
        expect(state().items.map((item) => item.id)).toEqual([
            "user-1",
            "assistant-1",
            "tool-1",
        ]);
        expect(state().items[1]?.toolCalls).toMatchObject([
            { id: "call-1", output: "file contents", isError: true },
            { id: "call-2", output: "" },
        ]);
        expect(state().hasMore).toBe(true);
    });
});

const openWith = async (hasMore: boolean) => {
    rpc.listMessages.mockResolvedValueOnce(
        page([{ id: "user-2", role: "user" }], hasMore),
    );
    await state().open("conversation-1");
};

describe("loadMore", () => {
    it("prepends the page before the oldest shown message", async () => {
        await openWith(true);
        rpc.listMessages.mockResolvedValueOnce(
            page([
                { id: "assistant-1", role: "assistant" },
                { id: "user-1", role: "user" },
            ]),
        );

        await state().loadMore();

        expect(rpc.listMessages).toHaveBeenLastCalledWith({
            conversationId: "conversation-1",
            beforeId: "user-2",
            limit: 50,
        });
        expect(state().items.map((item) => item.id)).toEqual([
            "user-1",
            "assistant-1",
            "user-2",
        ]);
        expect(state().hasMore).toBe(false);
    });

    it("loads one page at a time", async () => {
        await openWith(true);
        const older = Promise.withResolvers<ListMessagesResponse>();
        rpc.listMessages.mockReturnValueOnce(older.promise);

        const first = state().loadMore();
        await state().loadMore();
        older.resolve(page([{ id: "user-1", role: "user" }]));
        await first;

        expect(rpc.listMessages).toHaveBeenCalledTimes(2);
        expect(state().items).toHaveLength(2);
    });

    it("loads nothing without more history or an open conversation", async () => {
        await state().loadMore();
        await openWith(false);
        await state().loadMore();
        useActiveConversation.setState({ hasMore: true, items: [] });
        await state().loadMore();

        expect(rpc.listMessages).toHaveBeenCalledOnce();
    });

    it("drops a page that arrives after the conversation changed", async () => {
        await openWith(true);
        const older = Promise.withResolvers<ListMessagesResponse>();
        rpc.listMessages.mockReturnValueOnce(older.promise);

        const loading = state().loadMore();
        rpc.listMessages.mockResolvedValueOnce(
            page([{ id: "other-1", role: "user" }]),
        );
        await state().open("conversation-2");
        older.resolve(page([{ id: "user-1", role: "user" }]));
        await loading;

        expect(state().items.map((item) => item.id)).toEqual(["other-1"]);
    });

    it("drops a page whose anchor is no longer the oldest message", async () => {
        await openWith(true);
        const older = Promise.withResolvers<ListMessagesResponse>();
        rpc.listMessages.mockReturnValueOnce(older.promise);

        const loading = state().loadMore();
        useActiveConversation.setState({ items: [] });
        older.resolve(page([{ id: "user-1", role: "user" }]));
        await loading;

        expect(state().items).toEqual([]);
    });
});

describe("send", () => {
    beforeEach(async () => {
        rpc.listMessages.mockResolvedValue(page([]));
        await state().open("conversation-1");
    });

    it("streams thinking, text, tool calls, and a follow-up turn", async () => {
        rpc.sendMessage.mockReturnValue(
            stream([
                started("user-msg"),
                turnStarted("assistant-1"),
                thinking("let me look"),
                text("Reading."),
                event({
                    case: "toolCallStarted",
                    value: {
                        callId: "call-1",
                        name: "read_file",
                        arguments: '{"path":"a"}',
                    },
                }),
                event({
                    case: "toolCallFinished",
                    value: { callId: "call-1", content: "A", isError: false },
                }),
                event({
                    case: "toolCallFinished",
                    value: { callId: "call-9", content: "?", isError: true },
                }),
                turnStarted("assistant-2"),
                event({ case: "delta", value: {} }),
                { event: create(AgentEventSchema, {}) },
                {},
                text("It says A."),
                done(),
            ]),
        );

        await state().send("provider-1", "model-1", "what is in a?");

        expect(rpc.sendMessage.mock.lastCall?.[0]).toEqual({
            conversationId: "conversation-1",
            content: "what is in a?",
            providerId: "provider-1",
            model: "model-1",
        });
        const [user, first, second] = state().items;
        expect(user).toMatchObject({
            role: "user",
            content: "what is in a?",
            status: "done",
        });
        expect(first).toMatchObject({
            id: "assistant-1",
            thinking: "let me look",
            content: "Reading.",
            providerId: "provider-1",
            model: "model-1",
            toolCalls: [
                {
                    id: "call-1",
                    output: "A",
                    isError: false,
                    state: "done",
                },
            ],
        });
        expect(second).toMatchObject({
            id: "assistant-2",
            content: "It says A.",
            status: "done",
        });
        expect(state().streaming).toBe(false);
    });

    it.each([
        [
            "an error event",
            event({ case: "error", value: { message: "rate limited" } }),
            { status: "error", error: "rate limited" },
        ],
        [
            "an aborted event",
            event({ case: "aborted", value: {} }),
            { status: "aborted" },
        ],
    ])("ends the reply on %s", async (_case, last, expected) => {
        rpc.sendMessage.mockReturnValue(
            stream([started("user-msg"), turnStarted("assistant-1"), last]),
        );

        await state().send("provider-1", "model-1", "hi");

        expect(state().items.at(-1)).toMatchObject(expected);
    });

    it("ignores a send without an open conversation or while streaming", async () => {
        clearActiveConversation();
        await state().send("provider-1", "model-1", "hi");
        useActiveConversation.setState({
            conversationId: "conversation-1",
            streaming: true,
        });
        await state().send("provider-1", "model-1", "hi");

        expect(rpc.sendMessage).not.toHaveBeenCalled();
    });

    it("shows the failure when the stream breaks before the turn starts", async () => {
        rpc.sendMessage.mockReturnValue(
            stream([], new ConnectError("offline", Code.Unavailable)),
        );

        await state().send("provider-1", "model-1", "hi");

        expect(state().items.at(-1)).toMatchObject({
            status: "error",
            error: "Can't reach the server, check your connection and try again",
        });
        expect(rpc.resumeStream).not.toHaveBeenCalled();
    });

    it("resumes a broken stream from the events it already received", async () => {
        vi.useFakeTimers();
        rpc.sendMessage.mockReturnValue(
            stream(
                [started("user-msg"), turnStarted("assistant-1"), text("Hel")],
                new ConnectError("reset", Code.Unavailable),
            ),
        );
        rpc.resumeStream.mockReturnValue(stream([text("lo"), done()]));

        const sending = state().send("provider-1", "model-1", "hi");
        await vi.advanceTimersByTimeAsync(500);
        await sending;

        expect(rpc.resumeStream.mock.lastCall?.[0]).toEqual({
            messageId: "user-msg",
            offset: 3n,
        });
        expect(state().items.at(-1)).toMatchObject({
            content: "Hello",
            status: "done",
        });
    });

    it("gives up after three resumes", async () => {
        vi.useFakeTimers();
        const reset = new ConnectError("reset", Code.Unavailable);
        rpc.sendMessage.mockReturnValue(
            stream([started("user-msg"), turnStarted("assistant-1")], reset),
        );
        rpc.resumeStream.mockImplementation(() => stream([], reset));

        const sending = state().send("provider-1", "model-1", "hi");
        await vi.advanceTimersByTimeAsync(500 + 1000 + 1500);
        await sending;

        expect(rpc.resumeStream).toHaveBeenCalledTimes(3);
        expect(state().items.at(-1)).toMatchObject({ status: "error" });
    });

    it("reloads the conversation when the turn already finished", async () => {
        vi.useFakeTimers();
        rpc.sendMessage.mockReturnValue(
            stream(
                [started("user-msg")],
                new ConnectError("reset", Code.Unavailable),
            ),
        );
        rpc.resumeStream.mockReturnValue(stream([], turnNotRunning()));
        rpc.listMessages.mockResolvedValue(
            page([
                { id: "assistant-1", role: "assistant", content: "done" },
                { id: "user-msg", role: "user", content: "hi" },
            ]),
        );

        const sending = state().send("provider-1", "model-1", "hi");
        await vi.advanceTimersByTimeAsync(500);
        await sending;

        expect(state().items.map((item) => item.id)).toEqual([
            "user-msg",
            "assistant-1",
        ]);
        expect(state().streaming).toBe(false);
    });

    it("keeps a newer conversation when a finished turn reloads late", async () => {
        const reload = Promise.withResolvers<ListMessagesResponse>();
        rpc.sendMessage.mockReturnValue(
            stream([started("user-msg")], turnNotRunning()),
        );
        rpc.listMessages.mockReturnValue(reload.promise);

        const sending = state().send("provider-1", "model-1", "hi");
        await vi.waitFor(() => {
            expect(rpc.listMessages).toHaveBeenCalledTimes(2);
        });
        clearActiveConversation();
        reload.resolve(page([{ id: "user-msg", role: "user" }]));
        await sending;

        expect(state().items).toEqual([]);
        expect(state().conversationId).toBeNull();
    });

    it("stops the turn on the server and marks the reply aborted", async () => {
        rpc.sendMessage.mockImplementation((_req, { signal }) =>
            untilAborted([started("user-msg"), text("partial")], signal),
        );
        rpc.abortMessage.mockRejectedValue(new Error("already finished"));

        const sending = state().send("provider-1", "model-1", "hi");
        await vi.waitFor(() => {
            expect(state().items.at(-1)?.content).toBe("partial");
        });
        await state().abort();
        await sending;

        expect(rpc.abortMessage).toHaveBeenCalledWith({
            messageId: "user-msg",
        });
        expect(state().items.at(-1)?.status).toBe("aborted");
        expect(state().streaming).toBe(false);
    });

    it("aborts locally before the server names the message", async () => {
        rpc.sendMessage.mockImplementation((_req, { signal }) =>
            untilAborted([], signal),
        );

        const sending = state().send("provider-1", "model-1", "hi");
        await state().abort();
        await sending;
        await state().abort();

        expect(rpc.abortMessage).not.toHaveBeenCalled();
        expect(state().items.at(-1)?.status).toBe("aborted");
    });

    it("leaves the emptied conversation alone when cleared mid-stream", async () => {
        rpc.sendMessage.mockImplementation((_req, { signal }) =>
            untilAborted([started("user-msg")], signal),
        );

        const sending = state().send("provider-1", "model-1", "hi");
        await vi.waitFor(() => {
            expect(rpc.sendMessage).toHaveBeenCalled();
        });
        clearActiveConversation();
        await sending;

        expect(state()).toMatchObject({
            conversationId: null,
            items: [],
            streaming: false,
        });
    });
});
