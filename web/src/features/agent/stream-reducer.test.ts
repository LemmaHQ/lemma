import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { describe, expect, it, vi } from "vitest";

import { AgentEventSchema, type AgentEvent } from "@/gen/lemma/v1/agent_pb";

import {
    createStreamReducer,
    type LiveStep,
    type StreamSet,
    type StreamSlice,
} from "./stream-reducer";

function harness(withUser = false) {
    const state: StreamSlice = {
        items: [
            ...(withUser
                ? [
                      {
                          id: "user-temp",
                          parentId: "prev-1",
                          role: "user" as const,
                          content: "hello",
                          thinking: "",
                          status: "done" as const,
                          providerId: "",
                          model: "",
                          toolCalls: [],
                      },
                  ]
                : []),
            {
                id: "assistant-1",
                parentId: withUser ? "user-temp" : undefined,
                role: "assistant",
                content: "",
                thinking: "",
                status: "streaming",
                providerId: "provider-1",
                model: "model-1",
                toolCalls: [],
            },
        ],
        currentStep: null,
        reconnectingOffset: null,
    };
    const onStarted = vi.fn<(messageId: string, parentId?: string) => void>();
    const onTurnStarted = vi.fn<(messageId: string) => void>();
    const set: StreamSet = (fn) => {
        const patch = fn(state);
        state.items = patch.items ?? state.items;
        if (patch.currentStep !== undefined) {
            state.currentStep = patch.currentStep;
        }
        if (patch.reconnectingOffset !== undefined) {
            state.reconnectingOffset = patch.reconnectingOffset;
        }
    };
    const reducer = createStreamReducer({
        set,
        get: () => state,
        providerId: "provider-1",
        model: "model-1",
        initialId: "assistant-1",
        userPlaceholderId: withUser ? "user-temp" : undefined,
        onStarted,
        onTurnStarted: withUser ? onTurnStarted : undefined,
    });
    return {
        reducer,
        items: () => state.items,
        currentStep: (): LiveStep => state.currentStep,
        onStarted,
        onTurnStarted,
    };
}

function at(
    kind: NonNullable<MessageInitShape<typeof AgentEventSchema>["kind"]>,
    milliseconds: number,
): AgentEvent {
    return create(AgentEventSchema, {
        kind,
        occurredAt: timestampFromDate(new Date(milliseconds)),
    });
}

it("records parentId on user and assistant steps and tracks live currentStep", () => {
    const { reducer, items, currentStep, onStarted, onTurnStarted } =
        harness(true);
    reducer.applyEvent(
        at(
            {
                case: "started",
                value: { messageId: "user-1", parentId: "root-0" },
            },
            500,
        ),
    );
    expect(onStarted).toHaveBeenCalledWith("user-1", "root-0");
    expect(items()[0]).toMatchObject({ id: "user-1", parentId: "root-0" });
    expect(items()[1]).toMatchObject({ id: "assistant-1", parentId: "user-1" });

    reducer.applyEvent(
        at(
            {
                case: "turnStarted",
                value: { messageId: "a-1", parentId: "user-1" },
            },
            600,
        ),
    );
    expect(onTurnStarted).toHaveBeenCalledWith("a-1");
    expect(items()[1]).toMatchObject({ id: "a-1", parentId: "user-1" });
    expect(currentStep()).toBeNull();

    reducer.applyEvent(
        at(
            {
                case: "delta",
                value: {
                    part: { case: "thinking", value: { content: "hmm" } },
                },
            },
            1000,
        ),
    );
    expect(currentStep()).toEqual({ kind: "thinking" });

    reducer.applyEvent(
        at(
            {
                case: "toolCallStarted",
                value: { callId: "c1", name: "read_file", arguments: "{}" },
            },
            2000,
        ),
    );
    expect(currentStep()).toEqual({ kind: "tool", name: "read_file" });

    reducer.applyEvent(
        at(
            {
                case: "toolCallStarted",
                value: { callId: "c2", name: "bash", arguments: "{}" },
            },
            2100,
        ),
    );
    expect(currentStep()).toEqual({ kind: "tool", name: "bash" });

    reducer.applyEvent(
        at(
            {
                case: "toolCallFinished",
                value: { callId: "c2", content: "ok", isError: false },
            },
            2500,
        ),
    );
    expect(currentStep()).toEqual({ kind: "tool", name: "read_file" });

    reducer.applyEvent(
        at(
            {
                case: "toolCallFinished",
                value: { callId: "c1", content: "file", isError: false },
            },
            3000,
        ),
    );
    expect(currentStep()).toBeNull();

    reducer.applyEvent(
        at(
            {
                case: "turnStarted",
                value: { messageId: "a-2", parentId: "t-2" },
            },
            3100,
        ),
    );
    expect(items()).toHaveLength(3);
    expect(items()[2]).toMatchObject({ id: "a-2", parentId: "t-2" });

    reducer.applyEvent(
        at(
            {
                case: "delta",
                value: { part: { case: "text", value: { content: "answer" } } },
            },
            3500,
        ),
    );
    expect(currentStep()).toBeNull();

    reducer.applyEvent(at({ case: "done", value: {} }, 4000));
    expect(items()[2]).toMatchObject({ status: "done" });
    expect(currentStep()).toBeNull();

    reducer.applyEvent();
    reducer.applyEvent(create(AgentEventSchema, {}));
    reducer.applyEvent(at({ case: "delta", value: {} }, 4100));
});

it("handles empty parentId on started/turnStarted and updateCurrent", () => {
    const { reducer, items, currentStep } = harness(true);
    reducer.applyEvent(
        at(
            {
                case: "started",
                value: { messageId: "user-root", parentId: "" },
            },
            100,
        ),
    );
    expect(items()[0]).toMatchObject({ id: "user-root", parentId: undefined });

    reducer.applyEvent(
        at(
            {
                case: "turnStarted",
                value: { messageId: "a-root", parentId: "" },
            },
            200,
        ),
    );
    expect(items()[1]).toMatchObject({ id: "a-root", parentId: undefined });

    reducer.applyEvent(
        at(
            {
                case: "delta",
                value: { part: { case: "thinking", value: { content: "x" } } },
            },
            300,
        ),
    );
    expect(currentStep()).toEqual({ kind: "thinking" });

    reducer.updateCurrent({ content: "keep streaming" });
    expect(currentStep()).toEqual({ kind: "thinking" });

    reducer.updateCurrent({ status: "aborted" });
    expect(currentStep()).toBeNull();
});

it("uses server instants for thinking and tool execution", () => {
    const { reducer, items } = harness();
    reducer.applyEvent(
        at(
            {
                case: "delta",
                value: {
                    part: { case: "thinking", value: { content: "first" } },
                },
            },
            1000,
        ),
    );
    reducer.applyEvent(
        at(
            {
                case: "delta",
                value: {
                    part: { case: "thinking", value: { content: " second" } },
                },
            },
            2000,
        ),
    );
    reducer.applyEvent(
        at(
            {
                case: "delta",
                value: { part: { case: "text", value: { content: "answer" } } },
            },
            3500,
        ),
    );
    reducer.applyEvent(
        at(
            {
                case: "toolCallStarted",
                value: { callId: "call-1", name: "read_file", arguments: "{}" },
            },
            4000,
        ),
    );
    reducer.applyEvent(
        at(
            {
                case: "toolCallFinished",
                value: {
                    callId: "call-1",
                    content: "contents",
                    isError: false,
                },
            },
            6250,
        ),
    );

    expect(items()[0]).toMatchObject({
        thinkingStartedAt: 1000,
        thinkingFinishedAt: 3500,
    });
    expect(items()[0]?.toolCalls[0]).toMatchObject({
        startedAt: 4000,
        finishedAt: 6250,
        state: "done",
    });
});

it("finishes thinking on done and leaves legacy events untimed", () => {
    const { reducer, items, onStarted } = harness();
    reducer.applyEvent(
        at({ case: "started", value: { messageId: "user-0" } }, 900),
    );
    expect(onStarted).toHaveBeenCalledWith("user-0", undefined);
    reducer.applyEvent(
        at(
            {
                case: "delta",
                value: {
                    part: { case: "thinking", value: { content: "thinking" } },
                },
            },
            1000,
        ),
    );
    reducer.applyEvent(at({ case: "done", value: {} }, 5000));

    expect(items()[0]).toMatchObject({
        thinkingStartedAt: 1000,
        thinkingFinishedAt: 5000,
        status: "done",
    });

    const legacy = harness();
    legacy.reducer.applyEvent(
        create(AgentEventSchema, {
            kind: {
                case: "delta",
                value: {
                    part: { case: "thinking", value: { content: "thinking" } },
                },
            },
        }),
    );
    expect(legacy.items()[0]?.thinkingStartedAt).toBeUndefined();
});

it("normalizes an empty error message", () => {
    const { reducer, items } = harness();
    reducer.applyEvent(at({ case: "error", value: { message: "" } }, 2000));

    expect(items()[0]).toMatchObject({ status: "error", error: undefined });
});

type Kind = NonNullable<MessageInitShape<typeof AgentEventSchema>["kind"]>;

const thinkingDelta: Kind = {
    case: "delta",
    value: { part: { case: "thinking", value: { content: "hmm" } } },
};

const textDelta: Kind = {
    case: "delta",
    value: { part: { case: "text", value: { content: "answer" } } },
};

describe.each<[string, Kind]>([
    ["a text delta", textDelta],
    [
        "a tool call",
        {
            case: "toolCallStarted",
            value: { callId: "call-1", name: "bash", arguments: "{}" },
        },
    ],
    ["done", { case: "done", value: {} }],
    ["aborted", { case: "aborted", value: {} }],
    ["an error", { case: "error", value: { message: "failed" } }],
])("thinking interval on %s", (_name, kind) => {
    it("stays unset without thinking", () => {
        const { reducer, items } = harness();
        reducer.applyEvent(at(kind, 2000));

        expect(items()[0]?.thinkingFinishedAt).toBeUndefined();
    });

    it("ends at the first event after thinking", () => {
        const { reducer, items } = harness();
        reducer.applyEvent(at(thinkingDelta, 1000));
        reducer.applyEvent(at(kind, 2000));

        expect(items()[0]?.thinkingFinishedAt).toBe(2000);
    });

    it("keeps an interval that already ended", () => {
        const { reducer, items } = harness();
        reducer.applyEvent(at(thinkingDelta, 1000));
        reducer.applyEvent(at(textDelta, 1500));
        reducer.applyEvent(at(kind, 2000));

        expect(items()[0]?.thinkingFinishedAt).toBe(1500);
    });
});
