import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { expect, it } from "vitest";

import { AgentEventSchema, type AgentEvent } from "@/gen/lemma/v1/agent_pb";

import type { AgentItem } from "./agent-item";
import { createStreamReducer, type StreamSet } from "./stream-reducer";

function harness() {
    let items: AgentItem[] = [
        {
            id: "assistant-1",
            role: "assistant",
            content: "",
            thinking: "",
            status: "streaming",
            providerId: "provider-1",
            model: "model-1",
            toolCalls: [],
        },
    ];
    const set: StreamSet = (fn) => {
        const patch = fn({ items });
        items = patch.items ?? items;
    };
    const reducer = createStreamReducer(
        set,
        () => ({ items }),
        "provider-1",
        "model-1",
        "assistant-1",
        () => {},
    );
    return { reducer, items: () => items };
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
                    name: "read_file",
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
    const { reducer, items } = harness();
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
    reducer.applyEvent(at({ case: "done", value: { usage: {} } }, 5000));

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
