import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { expect, it } from "vitest";

import { MessageSchema } from "@/gen/lemma/v1/conversation_pb";

import { hydrateToolResults, protoToItem } from "./agent-item";

const startedMs = Date.parse("2026-10-29T10:00:00.000Z");
const finishedMs = Date.parse("2026-10-29T10:00:02.500Z");
const startedAt = timestampFromDate(new Date(startedMs));
const finishedAt = timestampFromDate(new Date(finishedMs));

it("maps stored thinking and tool timestamps to epoch milliseconds", () => {
    const item = protoToItem(
        create(MessageSchema, {
            id: "assistant-1",
            role: "assistant",
            thinking: "considering",
            thinkingStartedAt: startedAt,
            thinkingFinishedAt: finishedAt,
            toolCalls: [
                {
                    id: "call-1",
                    name: "read_file",
                    arguments: "{}",
                    startedAt,
                    finishedAt,
                },
            ],
        }),
    );

    expect(item.thinkingStartedAt).toBe(startedMs);
    expect(item.thinkingFinishedAt).toBe(finishedMs);
    expect(item.toolCalls[0]?.startedAt).toBe(startedMs);
    expect(item.toolCalls[0]?.finishedAt).toBe(finishedMs);
});

it("keeps timestamps absent for legacy rows and through result hydration", () => {
    const legacy = protoToItem(
        create(MessageSchema, {
            id: "assistant-1",
            role: "assistant",
            toolCalls: [{ id: "call-1", name: "read_file", arguments: "{}" }],
        }),
    );
    const result = protoToItem(
        create(MessageSchema, {
            id: "tool-1",
            role: "tool",
            content: "contents",
            toolResult: { toolCallId: "call-1", name: "read_file" },
        }),
    );
    const [hydrated] = hydrateToolResults([legacy, result]);

    expect(legacy.thinkingStartedAt).toBeUndefined();
    expect(legacy.toolCalls[0]?.startedAt).toBeUndefined();
    expect(hydrated?.toolCalls[0]).toMatchObject({
        output: "contents",
        startedAt: undefined,
        finishedAt: undefined,
    });
});
