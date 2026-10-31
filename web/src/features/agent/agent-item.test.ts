import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { expect, it } from "vitest";

import { MessageSchema, MessageStatus } from "@/gen/lemma/v1/conversation_pb";

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

it("hydrates a newer page's tool result into an older page's call", () => {
    const olderPage = hydrateToolResults([
        {
            id: "assistant-1",
            role: "assistant",
            content: "",
            thinking: "",
            status: "done",
            providerId: "provider-1",
            model: "model-1",
            toolCalls: [
                {
                    id: "call-1",
                    name: "read_file",
                    arguments: "{}",
                    output: "",
                    isError: false,
                    state: "done",
                },
            ],
        },
    ]);
    const currentPage = hydrateToolResults([
        {
            id: "tool-1",
            role: "tool",
            content: "contents",
            thinking: "",
            status: "done",
            providerId: "",
            model: "",
            toolCalls: [],
            toolCallId: "call-1",
        },
    ]);

    const [assistant] = hydrateToolResults([...olderPage, ...currentPage]);
    expect(assistant?.toolCalls[0]?.output).toBe("contents");
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
            toolResult: { toolCallId: "call-1" },
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

it.each([
    [MessageStatus.STREAMING, "", "streaming", undefined],
    [MessageStatus.ABORTED, "", "aborted", undefined],
    [MessageStatus.ERROR, "rate limited", "error", "rate limited"],
    [MessageStatus.DONE, "", "done", undefined],
] as const)(
    "maps stored status %s with error %j",
    (status, error, expectedStatus, expectedError) => {
        const item = protoToItem(
            create(MessageSchema, { id: "assistant-1", status, error }),
        );

        expect(item.status).toBe(expectedStatus);
        expect(item.error).toBe(expectedError);
    },
);
