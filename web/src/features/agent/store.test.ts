import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentEventSchema, type AgentEvent } from "@/gen/lemma/v1/agent_pb";
import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";
import {
    ListMessagesResponseSchema,
    MessageSchema,
    MessageStatus,
    SetMessageLabelResponseSchema,
    type ListMessagesResponse,
} from "@/gen/lemma/v1/session_pb";

import {
    beginCreatedSession,
    clearSessionDraft,
    useActiveSessionStore,
} from "./store";

type StreamResponse = { event?: AgentEvent | undefined };
type Stream = AsyncIterable<StreamResponse>;
type EventKind = NonNullable<MessageInitShape<typeof AgentEventSchema>["kind"]>;
type MessageInit = NonNullable<
    MessageInitShape<typeof ListMessagesResponseSchema>["messages"]
>[number];

const rpc = vi.hoisted(() => ({
    listMessages:
        vi.fn<(req: { sessionId: string }) => Promise<ListMessagesResponse>>(),
    setSessionLeaf:
        vi.fn<
            (req: { sessionId: string; leafId?: string }) => Promise<unknown>
        >(),
    setMessageLabel: vi.fn<
        (req: {
            sessionId: string;
            messageId: string;
            label: string;
        }) => Promise<{
            message?: { label?: string | undefined } | undefined;
        }>
    >(),
    sendMessage: vi.fn<
        (
            req: {
                sessionId: string;
                content: string;
                providerId: string;
                model: string;
                parentId?: string;
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
    sessionClient: {
        listMessages: rpc.listMessages,
        setSessionLeaf: rpc.setSessionLeaf,
        setMessageLabel: rpc.setMessageLabel,
    },
}));

const event = (kind: EventKind): StreamResponse => ({
    event: create(AgentEventSchema, { kind }),
});

const started = (messageId: string, parentId?: string) =>
    event({
        case: "started",
        value: parentId === undefined ? { messageId } : { messageId, parentId },
    });
const turnStarted = (messageId: string, parentId: string) =>
    event({ case: "turnStarted", value: { messageId, parentId } });
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

const treeResponse = (
    messages: MessageInit[],
    leafId?: string,
    activeMessageId?: string,
) =>
    create(ListMessagesResponseSchema, {
        messages,
        ...(leafId === undefined ? {} : { leafId }),
        ...(activeMessageId === undefined ? {} : { activeMessageId }),
    });

const state = () => useActiveSessionStore.getState();

const turnNotRunning = () =>
    new ConnectError("finished", Code.FailedPrecondition, undefined, [
        {
            desc: ErrorInfoSchema,
            value: { reason: ErrorReason.TURN_NOT_RUNNING },
        },
    ]);

beforeEach(() => {
    useActiveSessionStore.getState().reset();
    vi.resetAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("open", () => {
    it("loads full tree oldest first, hydrates tools, and derives active path", async () => {
        rpc.listMessages.mockResolvedValue(
            treeResponse(
                [
                    { id: "user-1", role: "user", content: "read it" },
                    {
                        id: "assistant-1",
                        parentId: "user-1",
                        role: "assistant",
                        status: MessageStatus.DONE,
                        toolCalls: [
                            { id: "call-1", name: "read_file" },
                            { id: "call-2", name: "bash" },
                        ],
                    },
                    {
                        id: "tool-1",
                        parentId: "assistant-1",
                        role: "tool",
                        content: "file contents",
                        toolResult: { toolCallId: "call-1", isError: true },
                    },
                    { id: "user-alt", role: "user", content: "other root" },
                ],
                "tool-1",
            ),
        );

        await state().open("session-1");

        expect(rpc.listMessages).toHaveBeenCalledWith({
            sessionId: "session-1",
        });
        expect(state().treeMessages).toHaveLength(4);
        expect(state().leafId).toBe("tool-1");
        expect(state().items.map((item) => item.id)).toEqual([
            "user-1",
            "assistant-1",
            "tool-1",
        ]);
        expect(state().items[1]?.toolCalls).toMatchObject([
            { id: "call-1", output: "file contents", isError: true },
            { id: "call-2", output: "" },
        ]);
    });

    it("handles empty leafId and ignores stale responses after switching session", async () => {
        const first = Promise.withResolvers<ListMessagesResponse>();
        rpc.listMessages
            .mockReturnValueOnce(first.promise)
            .mockResolvedValueOnce(treeResponse([], ""));

        const openingFirst = state().open("session-1");
        await state().open("session-2");
        first.resolve(
            treeResponse([{ id: "u1", role: "user", content: "stale" }], "u1"),
        );
        await openingFirst;

        expect(state().sessionId).toBe("session-2");
        expect(state().leafId).toBeUndefined();
        expect(state().items).toEqual([]);
    });

    it("automatically resumes activeMessageId on open and avoids duplicate tracking", async () => {
        const ts = timestampFromDate(new Date(1000));
        rpc.listMessages
            .mockResolvedValueOnce(
                treeResponse(
                    [
                        {
                            id: "u0",
                            role: "user",
                            content: "old",
                            createdAt: ts,
                        },
                        {
                            id: "a0",
                            parentId: "u0",
                            role: "assistant",
                            content: "ok",
                        },
                        {
                            id: "u1",
                            parentId: "a0",
                            role: "user",
                            content: "live q",
                            createdAt: ts,
                        },
                        {
                            id: "a1",
                            parentId: "u1",
                            role: "assistant",
                            providerId: "p1",
                            model: "m1",
                            content: "par",
                            status: MessageStatus.STREAMING,
                        },
                    ],
                    "a1",
                    "u1",
                ),
            )
            .mockResolvedValueOnce(
                treeResponse([{ id: "u1", role: "user" }], "u1", "u1"),
            )
            .mockResolvedValueOnce(
                treeResponse(
                    [
                        { id: "u0", role: "user", content: "old" },
                        {
                            id: "a0",
                            parentId: "u0",
                            role: "assistant",
                            content: "ok",
                        },
                        {
                            id: "u1",
                            parentId: "a0",
                            role: "user",
                            content: "live q",
                        },
                        {
                            id: "a1",
                            parentId: "u1",
                            role: "assistant",
                            content: "partial done",
                            status: MessageStatus.DONE,
                        },
                    ],
                    "a1",
                ),
            );
        rpc.resumeStream.mockImplementation((_req, { signal }) =>
            untilAborted(
                [
                    started("u1", "a0"),
                    turnStarted("a1", "u1"),
                    text("partial done"),
                ],
                signal,
            ),
        );
        rpc.abortMessage.mockResolvedValue({});
        const opening = state().open("session-1");
        await vi.waitFor(() => {
            expect(state().streaming).toBe(true);
            expect(state().items.at(-1)?.content).toBe("partial done");
        });

        await state().open("session-1");
        expect(rpc.resumeStream).toHaveBeenCalledTimes(1);

        await state().abort();
        await opening;
        expect(state().streaming).toBe(false);
    });

    it("resumes activeMessageId even when user message is absent from listMessages", async () => {
        rpc.listMessages
            .mockResolvedValueOnce(treeResponse([], undefined, "u-missing"))
            .mockResolvedValueOnce(
                treeResponse(
                    [
                        { id: "u-missing", role: "user", content: "hi" },
                        {
                            id: "a1",
                            parentId: "u-missing",
                            role: "assistant",
                            content: "ok",
                        },
                    ],
                    "a1",
                ),
            );
        rpc.resumeStream.mockReturnValue(
            stream([
                started("u-missing"),
                turnStarted("a1", "u-missing"),
                text("ok"),
                done(),
            ]),
        );

        await state().open("session-1");

        expect(rpc.resumeStream.mock.lastCall?.[0]).toEqual({
            messageId: "u-missing",
            offset: 0n,
        });
        expect(rpc.resumeStream.mock.lastCall?.[1]?.signal).toBeInstanceOf(
            AbortSignal,
        );
        expect(state().leafId).toBe("a1");
        expect(state().items.map((m) => m.id)).toEqual(["u-missing", "a1"]);
    });
});

describe("send", () => {
    beforeEach(async () => {
        rpc.listMessages.mockResolvedValue(treeResponse([]));
        await state().open("session-1");
    });

    it("streams thinking, text, tool calls, follow-up turn, and reloads DB tree", async () => {
        const settled = treeResponse(
            [
                { id: "user-msg", role: "user", content: "what is in a?" },
                {
                    id: "assistant-1",
                    parentId: "user-msg",
                    role: "assistant",
                    thinking: "let me look",
                    content: "Reading.",
                    providerId: "provider-1",
                    model: "model-1",
                    toolCalls: [
                        {
                            id: "call-1",
                            name: "read_file",
                            arguments: '{"path":"a"}',
                        },
                    ],
                },
                {
                    id: "tool-1",
                    parentId: "assistant-1",
                    role: "tool",
                    content: "A",
                    toolResult: { toolCallId: "call-1", isError: false },
                },
                {
                    id: "assistant-2",
                    parentId: "tool-1",
                    role: "assistant",
                    content: "It says A.",
                    status: MessageStatus.DONE,
                },
            ],
            "assistant-2",
        );
        rpc.listMessages.mockResolvedValueOnce(settled);
        rpc.sendMessage.mockReturnValue(
            stream([
                started("user-msg"),
                turnStarted("assistant-1", "user-msg"),
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
                turnStarted("assistant-2", "tool-1"),
                text("It says A."),
                done(),
            ]),
        );

        await state().send("provider-1", "model-1", "what is in a?");

        expect(rpc.sendMessage.mock.lastCall?.[0]).toEqual({
            sessionId: "session-1",
            content: "what is in a?",
            providerId: "provider-1",
            model: "model-1",
        });
        expect(state().leafId).toBe("assistant-2");
        expect(state().treeMessages.map((m) => m.id)).toEqual([
            "user-msg",
            "assistant-1",
            "tool-1",
            "assistant-2",
        ]);
        expect(state().items[1]?.toolCalls[0]).toMatchObject({
            id: "call-1",
            output: "A",
            isError: false,
        });
        expect(state().streaming).toBe(false);
    });

    it("supports explicitParentId for root and UUID branches and swallows reload error", async () => {
        rpc.sendMessage.mockReturnValue(
            stream([
                started("u-root", ""),
                turnStarted("a-1", "u-root"),
                text("hi"),
                done(),
            ]),
        );
        rpc.listMessages.mockRejectedValueOnce(new Error("reload hiccup"));

        await state().send("p1", "m1", "new root", "");

        expect(rpc.sendMessage.mock.lastCall?.[0]).toEqual({
            sessionId: "session-1",
            content: "new root",
            providerId: "p1",
            model: "m1",
            parentId: "",
        });
        expect(state().items.map((m) => m.id)).toEqual(["u-root", "a-1"]);

        rpc.listMessages.mockResolvedValueOnce(
            treeResponse(
                [
                    { id: "u-root", role: "user", content: "new root" },
                    {
                        id: "u-branch",
                        parentId: "u-root",
                        role: "user",
                        content: "fork",
                    },
                    {
                        id: "a-2",
                        parentId: "u-branch",
                        role: "assistant",
                        content: "forked",
                    },
                ],
                "a-2",
            ),
        );
        rpc.sendMessage.mockReturnValue(
            stream([
                started("u-branch", "u-root"),
                turnStarted("a-2", "u-branch"),
                text("forked"),
                done(),
            ]),
        );

        await state().send("p1", "m1", "fork", "u-root");

        expect(rpc.sendMessage.mock.lastCall?.[0]).toMatchObject({
            parentId: "u-root",
        });
        expect(state().leafId).toBe("a-2");
    });

    it("ignores send without open session or while streaming", async () => {
        useActiveSessionStore.getState().reset();
        await state().send("provider-1", "model-1", "hi");
        useActiveSessionStore.setState({
            sessionId: "session-1",
            streaming: true,
        });
        await state().send("provider-1", "model-1", "hi");

        expect(rpc.sendMessage).not.toHaveBeenCalled();
    });

    it("shows failure when stream breaks before turn starts", async () => {
        rpc.sendMessage.mockReturnValue(
            stream([], new ConnectError("offline", Code.Unavailable)),
        );

        await state().send("provider-1", "model-1", "hi");

        expect(state().items.at(-1)).toMatchObject({
            status: "error",
            error: "Connection failed, try again",
        });
        expect(rpc.resumeStream).not.toHaveBeenCalled();
    });

    it("tracks reconnectingOffset across broken stream resume and settles", async () => {
        vi.useFakeTimers();
        rpc.sendMessage.mockReturnValue(
            stream(
                [
                    started("user-msg"),
                    turnStarted("assistant-1", "user-msg"),
                    text("Hel"),
                ],
                new ConnectError("reset", Code.Unavailable),
            ),
        );
        rpc.resumeStream.mockReturnValue(stream([text("lo"), done()]));
        rpc.listMessages.mockResolvedValueOnce(
            treeResponse(
                [
                    { id: "user-msg", role: "user", content: "hi" },
                    {
                        id: "assistant-1",
                        parentId: "user-msg",
                        role: "assistant",
                        content: "Hello",
                        status: MessageStatus.DONE,
                    },
                ],
                "assistant-1",
            ),
        );

        const sending = state().send("provider-1", "model-1", "hi");
        await vi.waitFor(() => {
            expect(state().reconnectingOffset).toBe(3);
        });
        await vi.advanceTimersByTimeAsync(500);
        await sending;

        expect(rpc.resumeStream.mock.lastCall?.[0]).toEqual({
            messageId: "user-msg",
            offset: 3n,
        });
        expect(state().reconnectingOffset).toBeNull();
        expect(state().items.at(-1)).toMatchObject({
            content: "Hello",
            status: "done",
        });
    });

    it("gives up after three resumes", async () => {
        vi.useFakeTimers();
        const reset = new ConnectError("reset", Code.Unavailable);
        rpc.sendMessage.mockReturnValue(
            stream(
                [started("user-msg"), turnStarted("assistant-1", "user-msg")],
                reset,
            ),
        );
        rpc.resumeStream.mockImplementation(() => stream([], reset));

        const sending = state().send("provider-1", "model-1", "hi");
        await vi.advanceTimersByTimeAsync(500 + 1000 + 1500);
        await sending;

        expect(rpc.resumeStream).toHaveBeenCalledTimes(3);
        expect(state().items.at(-1)).toMatchObject({ status: "error" });
        expect(state().reconnectingOffset).toBeNull();
    });

    it("reloads session when TURN_NOT_RUNNING occurs and drops stale reloads", async () => {
        const reload = Promise.withResolvers<ListMessagesResponse>();
        rpc.sendMessage.mockReturnValue(
            stream([started("user-msg")], turnNotRunning()),
        );
        rpc.listMessages
            .mockReturnValueOnce(reload.promise)
            .mockResolvedValueOnce(treeResponse([]));

        const sending = state().send("provider-1", "model-1", "hi");
        await vi.waitFor(() => {
            expect(rpc.listMessages).toHaveBeenCalledTimes(2);
        });
        const switching = state().open("session-2");
        reload.resolve(
            treeResponse([{ id: "user-msg", role: "user" }], "user-msg"),
        );
        await Promise.all([sending, switching]);

        expect(state().items).toEqual([]);
        expect(state().sessionId).toBe("session-2");
    });

    it("aborts before and after server names the message and ignores mid-stream switch", async () => {
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

        rpc.sendMessage.mockImplementation((_req, { signal }) =>
            untilAborted([], signal),
        );
        const preAbort = state().send("provider-1", "model-1", "hi");
        await state().abort();
        await preAbort;
        await state().abort();
        expect(state().items.at(-1)?.status).toBe("aborted");

        rpc.sendMessage.mockImplementation((_req, { signal }) =>
            untilAborted([started("user-msg")], signal),
        );
        rpc.listMessages.mockResolvedValueOnce(
            treeResponse([{ id: "other-1", role: "user" }], "other-1"),
        );
        const switched = state().send("provider-1", "model-1", "hi");
        await vi.waitFor(() => {
            expect(rpc.sendMessage).toHaveBeenCalled();
        });
        await state().open("session-2");
        await switched;

        expect(state()).toMatchObject({
            sessionId: "session-2",
            items: [{ id: "other-1" }],
            streaming: false,
        });
    });
});

const setupTree = async () => {
    rpc.listMessages.mockResolvedValue(
        treeResponse(
            [
                { id: "u1", role: "user", content: "first q" },
                {
                    id: "a1",
                    parentId: "u1",
                    role: "assistant",
                    content: "first a",
                },
                {
                    id: "u2",
                    parentId: "a1",
                    role: "user",
                    content: "second q",
                },
                {
                    id: "a2",
                    parentId: "u2",
                    role: "assistant",
                    content: "second a",
                },
            ],
            "a2",
        ),
    );
    await state().open("session-1");
};
describe("branching, rewind, and labeling", () => {
    it("switches active leaf and ignores stale or closed-session calls", async () => {
        await state().switchLeaf("a1");
        expect(rpc.setSessionLeaf).not.toHaveBeenCalled();

        await setupTree();
        rpc.setSessionLeaf.mockResolvedValue({});

        await state().switchLeaf("a1");
        expect(rpc.setSessionLeaf).toHaveBeenCalledWith({
            sessionId: "session-1",
            leafId: "a1",
        });
        expect(state().leafId).toBe("a1");
        expect(state().items.map((m) => m.id)).toEqual(["u1", "a1"]);

        await state().switchLeaf(undefined);
        expect(rpc.setSessionLeaf).toHaveBeenLastCalledWith({
            sessionId: "session-1",
        });
        expect(state().items).toEqual([]);

        useActiveSessionStore.setState({ streaming: true });
        rpc.setSessionLeaf.mockClear();
        await state().switchLeaf("a1");
        expect(rpc.setSessionLeaf).not.toHaveBeenCalled();
        useActiveSessionStore.setState({ streaming: false });

        const pending = Promise.withResolvers<unknown>();
        rpc.setSessionLeaf.mockReturnValueOnce(pending.promise);
        const switching = state().switchLeaf("a2");
        rpc.listMessages.mockResolvedValueOnce(treeResponse([]));
        await state().open("session-2");
        pending.resolve({});
        await switching;
        expect(state().sessionId).toBe("session-2");
    });

    it("rewinds to a user message, preserves backupLeafId, cancels, or sends branch", async () => {
        await setupTree();
        state().cancelRewind();
        state().startRewind("missing");
        state().startRewind("a1");
        expect(state().rewind).toBeNull();

        state().startRewind("u2");
        expect(state().rewind).toEqual({
            backupLeafId: "a2",
            parentId: "a1",
            previousDraft: "",
        });
        expect(state().leafId).toBe("a1");
        expect(state().items.map((m) => m.id)).toEqual(["u1", "a1"]);

        state().startRewind("u1");
        expect(state().rewind).toEqual({
            backupLeafId: "a2",
            parentId: undefined,
            previousDraft: "",
        });
        expect(state().items).toEqual([]);

        state().cancelRewind();
        expect(state().rewind).toBeNull();
        expect(state().leafId).toBe("a2");
        expect(state().items.map((m) => m.id)).toEqual([
            "u1",
            "a1",
            "u2",
            "a2",
        ]);

        state().startRewind("u1");
        rpc.sendMessage.mockReturnValue(
            stream([
                started("u-new", ""),
                turnStarted("a-new", "u-new"),
                done(),
            ]),
        );
        rpc.listMessages.mockResolvedValueOnce(
            treeResponse(
                [
                    { id: "u-new", role: "user", content: "edited q" },
                    {
                        id: "a-new",
                        parentId: "u-new",
                        role: "assistant",
                        content: "ok",
                    },
                ],
                "a-new",
            ),
        );
        await state().send("p1", "m1", "edited q");
        expect(rpc.sendMessage.mock.lastCall?.[0]).toMatchObject({
            parentId: "",
        });
        expect(state().rewind).toBeNull();

        useActiveSessionStore.setState({ streaming: true });
        state().startRewind("u1");
        expect(state().rewind).toBeNull();
    });

    it("labels messages and patches treeMessages and active items", async () => {
        await state().labelMessage("u1", "pin");
        expect(rpc.setMessageLabel).not.toHaveBeenCalled();

        await setupTree();
        rpc.setMessageLabel.mockResolvedValueOnce(
            create(SetMessageLabelResponseSchema, {
                message: create(MessageSchema, { id: "u2", label: "pinned" }),
            }),
        );
        await state().labelMessage("u2", "pinned");
        expect(state().treeMessages.find((m) => m.id === "u2")?.label).toBe(
            "pinned",
        );
        expect(state().items.find((m) => m.id === "u2")?.label).toBe("pinned");

        rpc.setMessageLabel.mockResolvedValueOnce({});
        await state().labelMessage("u2", "");
        expect(
            state().treeMessages.find((m) => m.id === "u2")?.label,
        ).toBeUndefined();

        const pending = Promise.withResolvers<{ message?: undefined }>();
        rpc.setMessageLabel.mockReturnValueOnce(pending.promise);
        const labeling = state().labelMessage("u1", "late");
        rpc.listMessages.mockResolvedValueOnce(treeResponse([]));
        await state().open("session-2");
        pending.resolve({});
        await labeling;
        expect(state().sessionId).toBe("session-2");
    });
});

describe("drafts and created session seeding", () => {
    it("isolates drafts per session, restores pre-rewind draft on cancel, and seeds created sessions", async () => {
        state().setDraft("", "home draft");
        state().setDraft("s1", "s1 draft");
        state().setDraft("s1", "");
        state().setDraft("s2", "s2 draft");
        expect(state().drafts).toEqual({
            "": "home draft",
            s2: "s2 draft",
        });

        clearSessionDraft("s2");
        clearSessionDraft("missing");
        expect(state().drafts).toEqual({ "": "home draft" });

        beginCreatedSession("s-created");
        expect(state().sessionId).toBe("s-created");
        expect(state().loadedSessionId).toBe("s-created");
        expect(state().drafts).toEqual({});

        rpc.listMessages.mockResolvedValueOnce(
            treeResponse(
                [
                    { id: "u1", role: "user", content: "first q" },
                    {
                        id: "a1",
                        parentId: "u1",
                        role: "assistant",
                        content: "r1",
                    },
                    {
                        id: "u2",
                        parentId: "a1",
                        role: "user",
                        content: "second q",
                    },
                ],
                "u2",
            ),
        );
        await state().open("s-rewind");
        state().setDraft("s-rewind", "unsent thought");
        state().startRewind("u2");
        expect(state().drafts["s-rewind"]).toBe("second q");
        state().startRewind("u1");
        expect(state().drafts["s-rewind"]).toBe("first q");
        state().cancelRewind();
        expect(state().drafts["s-rewind"]).toBe("unsent thought");
    });
});
