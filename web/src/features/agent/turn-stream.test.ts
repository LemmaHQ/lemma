import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type AgentEvent, AgentEventSchema } from "@/gen/lemma/v1/agent_pb";
import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";

import type { AgentItem } from "./agent-item";
import {
    EMPTY_SESSION_SLICE,
    nonEmptyId,
    prepareNewTurn,
    prepareResumedTurn,
    type TurnStoreSlice,
} from "./turn-prep";
import { runSessionTurn, runTurn, type Turn } from "./turn-stream";

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

const makeTurn = (messageId: string | null = "user-1"): Turn => ({
    controller: new AbortController(),
    messageId,
    userAborted: false,
});

const textEvent = () => ({
    event: create(AgentEventSchema, {
        kind: {
            case: "delta",
            value: { part: { case: "text", value: { content: "hi" } } },
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

const noopApply = () => {};
const noopUpdate = (_patch: Partial<AgentItem>) => {};
const noopReload = () => Promise.resolve();
const failedText = () => "failed";

afterEach(() => {
    vi.useRealTimers();
});

describe("runTurn", () => {
    it("notifies onReconnecting with received offset and clears it when events resume", async () => {
        vi.useFakeTimers();
        const turn = makeTurn();
        const reconnecting: (number | null)[] = [];
        const applyEvent = vi.fn<(event?: AgentEvent) => void>();
        const openStream = vi
            .fn<
                (
                    received: number,
                ) => AsyncIterable<{ event?: AgentEvent | undefined }>
            >()
            .mockReturnValueOnce(stream([textEvent()], new Error("dropped")))
            .mockReturnValueOnce(stream([textEvent()]));

        const running = runTurn(turn, {
            openStream,
            applyEvent,
            updateCurrent: noopUpdate,
            reload: noopReload,
            failedText,
            onReconnecting: (offset) => {
                reconnecting.push(offset);
            },
        });

        await vi.advanceTimersByTimeAsync(500);
        await running;

        expect(reconnecting).toEqual([1, null]);
        expect(applyEvent).toHaveBeenCalledTimes(2);
    });

    it("clears reconnecting when the resumed stream closes empty", async () => {
        vi.useFakeTimers();
        const turn = makeTurn();
        const reconnecting: (number | null)[] = [];
        const openStream = vi
            .fn<
                (
                    received: number,
                ) => AsyncIterable<{ event?: AgentEvent | undefined }>
            >()
            .mockReturnValueOnce(
                stream([textEvent(), textEvent()], new Error("dropped")),
            )
            .mockReturnValueOnce(stream([]));

        const running = runTurn(turn, {
            openStream,
            applyEvent: noopApply,
            updateCurrent: noopUpdate,
            reload: noopReload,
            failedText,
            onReconnecting: (offset) => {
                reconnecting.push(offset);
            },
        });

        await vi.advanceTimersByTimeAsync(500);
        await running;

        expect(reconnecting).toEqual([2, null]);
    });

    it("clears reconnecting on abort, TURN_NOT_RUNNING, and max resume exhaustion", async () => {
        vi.useFakeTimers();
        const abortTurn = makeTurn();
        const abortStates: (number | null)[] = [];
        const updateCurrent = vi.fn<(patch: Partial<AgentItem>) => void>();
        const abortOpen = vi
            .fn<
                (
                    received: number,
                ) => AsyncIterable<{ event?: AgentEvent | undefined }>
            >()
            .mockReturnValueOnce(stream([textEvent()], new Error("drop")))
            .mockImplementationOnce(() => {
                abortTurn.controller.abort();
                return stream([], new ConnectError("canceled", Code.Canceled));
            });

        const abortRun = runTurn(abortTurn, {
            openStream: abortOpen,
            applyEvent: noopApply,
            updateCurrent,
            reload: noopReload,
            failedText,
            onReconnecting: (o) => {
                abortStates.push(o);
            },
        });
        await vi.advanceTimersByTimeAsync(500);
        await abortRun;
        expect(abortStates).toEqual([1, null]);
        expect(updateCurrent).toHaveBeenCalledWith({ status: "aborted" });

        const reload = vi.fn<() => Promise<void>>().mockResolvedValue();
        const finishedStates: (number | null)[] = [];
        const finishedOpen = vi
            .fn<
                (
                    received: number,
                ) => AsyncIterable<{ event?: AgentEvent | undefined }>
            >()
            .mockReturnValueOnce(stream([textEvent()], new Error("drop")))
            .mockReturnValueOnce(stream([], turnNotRunning()));
        const finishedRun = runTurn(makeTurn(), {
            openStream: finishedOpen,
            applyEvent: noopApply,
            updateCurrent: noopUpdate,
            reload,
            failedText,
            onReconnecting: (o) => {
                finishedStates.push(o);
            },
        });
        await vi.advanceTimersByTimeAsync(500);
        await finishedRun;
        expect(finishedStates).toEqual([1, null]);
        expect(reload).toHaveBeenCalledOnce();

        const exhaustedStates: (number | null)[] = [];
        const exhaustedUpdate = vi.fn<(patch: Partial<AgentItem>) => void>();
        const exhaustedRun = runTurn(makeTurn(), {
            openStream: () => stream([], new Error("offline")),
            applyEvent: noopApply,
            updateCurrent: exhaustedUpdate,
            reload: noopReload,
            failedText: () => "network error",
            onReconnecting: (o) => {
                exhaustedStates.push(o);
            },
        });
        await vi.advanceTimersByTimeAsync(500 + 1000 + 1500);
        await exhaustedRun;
        expect(exhaustedStates).toEqual([0, 0, 0, null]);
        expect(exhaustedUpdate).toHaveBeenCalledWith({
            status: "error",
            error: "network error",
        });
    });
});

describe("prepareResumedTurn and runSessionTurn", () => {
    it("removes the active turn subtree and ignores stale updates after turn switches", async () => {
        vi.useFakeTimers();
        expect(EMPTY_SESSION_SLICE.streaming).toBe(false);
        expect(nonEmptyId("")).toBeUndefined();
        expect(nonEmptyId("id-1")).toBe("id-1");

        const u0: AgentItem = {
            id: "u0",
            role: "user",
            content: "prev",
            thinking: "",
            status: "done",
            providerId: "",
            model: "",
            toolCalls: [],
        };
        const u1: AgentItem = {
            ...u0,
            id: "u1",
            parentId: "u0",
            content: "live",
        };
        const a1: AgentItem = {
            id: "a1",
            parentId: "u1",
            role: "assistant",
            content: "step 1",
            thinking: "",
            status: "done",
            providerId: "p1",
            model: "m1",
            toolCalls: [],
        };
        const t1: AgentItem = {
            id: "t1",
            parentId: "a1",
            role: "tool",
            content: "res",
            thinking: "",
            status: "done",
            providerId: "",
            model: "",
            toolCalls: [],
        };

        const resumed = prepareResumedTurn([u0, u1, a1, t1], "u1");
        expect(resumed.preTree.map((m) => m.id)).toEqual(["u0"]);
        expect(resumed.baseCount).toBe(1);

        const created = prepareNewTurn([u0], "u0", "p1", "m1", "next");
        expect(created.baseCount).toBe(1);

        let slice: TurnStoreSlice = resumed.patch;
        let current = true;
        const own = makeTurn("u1");
        const openStream = vi
            .fn<
                (
                    received: number,
                    signal: AbortSignal,
                ) => AsyncIterable<{ event?: AgentEvent | undefined }>
            >()
            .mockReturnValueOnce(stream([textEvent()], new Error("dropped")))
            .mockImplementationOnce(() => {
                current = false;
                return stream([
                    textEvent(),
                    {
                        event: create(AgentEventSchema, {
                            kind: {
                                case: "turnStarted",
                                value: { messageId: "a2", parentId: "t1" },
                            },
                        }),
                    },
                ]);
            });
        const running = runSessionTurn({
            own,
            prepared: resumed,
            isCurrent: () => current,
            getSlice: () => slice,
            patchStore: (fn) => {
                slice = { ...slice, ...fn(slice) };
            },
            openStream,
            reload: noopReload,
            failedText: () => "err",
            onSettled: () => {},
        });

        await vi.advanceTimersByTimeAsync(500);
        await running;

        expect(slice.reconnectingOffset).toBe(1);
    });
});
