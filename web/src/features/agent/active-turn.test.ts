import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type AgentEvent, AgentEventSchema } from "@/gen/lemma/v1/agent_pb";
import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";

import { EMPTY_SESSION_SLICE, type TurnStoreSlice } from "./active-path";
import { createActiveTurnRunner } from "./active-turn";
import type { AgentItem } from "./agent-item";

async function* stream(
    events: { event?: AgentEvent | undefined }[],
    failure?: Error,
) {
    await Promise.resolve();
    yield* events;
    if (failure !== undefined) {
        throw failure;
    }
}

const startedEvent = (messageId: string) => ({
    event: create(AgentEventSchema, {
        kind: { case: "started", value: { messageId } },
    }),
});

const textEvent = (content = "hi") => ({
    event: create(AgentEventSchema, {
        kind: {
            case: "delta",
            value: { part: { case: "text", value: { content } } },
        },
    }),
});

const turnNotRunning = () =>
    new ConnectError("done", Code.FailedPrecondition, undefined, [
        {
            desc: ErrorInfoSchema,
            value: { reason: ErrorReason.TURN_NOT_RUNNING },
        },
    ]);

function makeHarness() {
    let slice: TurnStoreSlice = { ...EMPTY_SESSION_SLICE };
    const reconnectingHistory: (number | null)[] = [];
    const sendMessage =
        vi.fn<Parameters<typeof createActiveTurnRunner>[0]["sendMessage"]>();
    const resumeStream =
        vi.fn<Parameters<typeof createActiveTurnRunner>[0]["resumeStream"]>();
    const abortMessage = vi.fn<
        Parameters<typeof createActiveTurnRunner>[0]["abortMessage"]
    >(() => Promise.resolve({}));
    const reload = vi.fn<
        Parameters<typeof createActiveTurnRunner>[0]["reload"]
    >(() => Promise.resolve());
    const runner = createActiveTurnRunner({
        getSlice: () => slice,
        patchStore: (patch) => {
            const next = typeof patch === "function" ? patch(slice) : patch;
            if (
                "reconnectingOffset" in next &&
                next.reconnectingOffset !== undefined
            ) {
                reconnectingHistory.push(next.reconnectingOffset);
            }
            slice = { ...slice, ...next };
        },
        sendMessage,
        resumeStream,
        abortMessage,
        reload,
        failedText: () => "network error",
    });

    return {
        runner,
        getSlice: () => slice,
        reconnectingHistory,
        sendMessage,
        resumeStream,
        abortMessage,
        reload,
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe("createActiveTurnRunner", () => {
    it("reconnects broken streams using messageId and clears reconnectingOffset", async () => {
        vi.useFakeTimers();
        const h = makeHarness();
        h.sendMessage.mockReturnValueOnce(
            stream([startedEvent("u1"), textEvent("a")], new Error("dropped")),
        );
        h.resumeStream.mockReturnValueOnce(stream([textEvent("b")]));

        const running = h.runner.send({
            sessionId: "s1",
            treeMessages: [],
            targetParentId: undefined,
            requestParentId: undefined,
            providerId: "p1",
            model: "m1",
            content: "hello",
        });

        await vi.advanceTimersByTimeAsync(500);
        await running;

        expect(h.resumeStream).toHaveBeenCalledWith(
            "u1",
            1n + 1n,
            expect.any(AbortSignal),
        );
        expect(h.reconnectingHistory).toEqual([null, 2, null, null]);
        expect(h.reload).toHaveBeenCalledOnce();

        h.sendMessage.mockReturnValueOnce(
            stream([
                {
                    event: create(AgentEventSchema, {
                        kind: {
                            case: "error",
                            value: { message: "bad key" },
                        },
                    }),
                },
            ]),
        );
        await h.runner.send({
            sessionId: "s1",
            treeMessages: [],
            targetParentId: undefined,
            requestParentId: undefined,
            providerId: "p1",
            model: "m1",
            content: "err",
        });

        h.sendMessage.mockReturnValueOnce(
            stream([
                {
                    event: create(AgentEventSchema, {
                        kind: { case: "aborted", value: {} },
                    }),
                },
            ]),
        );
        await h.runner.send({
            sessionId: "s1",
            treeMessages: [],
            targetParentId: undefined,
            requestParentId: undefined,
            providerId: "p1",
            model: "m1",
            content: "stop",
        });
    });

    it("handles TURN_NOT_RUNNING reload, max-resume exhaustion, abort, and cancel", async () => {
        vi.useFakeTimers();
        const u1: AgentItem = {
            id: "u1",
            role: "user",
            content: "q",
            thinking: "",
            status: "done",
            providerId: "",
            model: "",
            toolCalls: [],
        };

        const remoteDone = makeHarness();
        remoteDone.resumeStream
            .mockReturnValueOnce(stream([textEvent()], new Error("drop")))
            .mockReturnValueOnce(stream([], turnNotRunning()));
        const run1 = remoteDone.runner.resume({
            sessionId: "s1",
            treeMessages: [u1],
            activeMessageId: "u1",
        });
        expect(remoteDone.runner.isCurrentMessage("u1")).toBe(true);
        await vi.advanceTimersByTimeAsync(500);
        await run1;
        expect(remoteDone.reload).toHaveBeenCalledTimes(1);

        const exhausted = makeHarness();
        exhausted.resumeStream.mockImplementation(() =>
            stream([], new Error("offline")),
        );
        const run2 = exhausted.runner.resume({
            sessionId: "s1",
            treeMessages: [u1],
            activeMessageId: "u1",
        });
        await vi.advanceTimersByTimeAsync(500 + 1000 + 1500);
        await run2;
        expect(exhausted.getSlice().items.at(-1)).toMatchObject({
            status: "error",
            error: "network error",
        });

        const aborted = makeHarness();
        aborted.resumeStream.mockImplementation(
            (_id, _offset, signal: AbortSignal) => ({
                async *[Symbol.asyncIterator]() {
                    const wait = Promise.withResolvers<never>();
                    signal.addEventListener("abort", () => {
                        wait.reject(
                            new ConnectError("canceled", Code.Canceled),
                        );
                    });
                    yield textEvent();
                    await wait.promise;
                },
            }),
        );
        const run3 = aborted.runner.resume({
            sessionId: "s1",
            treeMessages: [u1],
            activeMessageId: "u1",
        });
        await Promise.resolve();
        await aborted.runner.abort();
        await run3;
        expect(aborted.abortMessage).toHaveBeenCalledWith("u1");
        expect(aborted.getSlice().items.at(-1)?.status).toBe("aborted");

        const canceled = makeHarness();
        canceled.resumeStream
            .mockReturnValueOnce(stream([textEvent()], new Error("drop")))
            .mockImplementationOnce(() => {
                canceled.runner.cancel();
                return stream([
                    textEvent("ignored"),
                    {
                        event: create(AgentEventSchema, {
                            kind: {
                                case: "turnStarted",
                                value: { messageId: "a2", parentId: "u1" },
                            },
                        }),
                    },
                ]);
            });
        const run4 = canceled.runner.resume({
            sessionId: "s1",
            treeMessages: [u1],
            activeMessageId: "u1",
        });
        await vi.advanceTimersByTimeAsync(500);
        await run4;
        expect(canceled.runner.isCurrentMessage("u1")).toBe(false);
    });
});
