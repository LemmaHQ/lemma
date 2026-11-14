import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { expect, it } from "vitest";

import { MessageSchema, MessageStatus } from "@/gen/lemma/v1/session_pb";

import {
    collapseToolItems,
    hydrateToolResults,
    isBlankReply,
    protoToItem,
    replyView,
} from "./agent-item";

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

it("maps parentId, label, and createdAtMs in protoToItem", () => {
    const user = protoToItem(
        create(MessageSchema, {
            id: "user-1",
            parentId: "root-0",
            role: "user",
            content: "hello",
            createdAt: startedAt,
            label: "checkpoint",
        }),
    );
    const cleared = protoToItem(
        create(MessageSchema, {
            id: "user-2",
            parentId: "",
            role: "user",
            label: "",
        }),
    );

    expect(user).toMatchObject({
        id: "user-1",
        parentId: "root-0",
        role: "user",
        createdAtMs: startedMs,
        label: "checkpoint",
    });
    expect(cleared.parentId).toBeUndefined();
    expect(cleared.label).toBeUndefined();
    expect(cleared.createdAtMs).toBeUndefined();
});

it("computes isBlankReply and replyView for streaming and settled replies", () => {
    const blank = protoToItem(
        create(MessageSchema, {
            id: "a-1",
            role: "assistant",
            status: MessageStatus.STREAMING,
        }),
    );
    const active = { ...blank, content: "hi" };
    const settled = { ...blank, status: "done" as const };

    expect(isBlankReply(blank)).toBe(true);
    expect(isBlankReply(active)).toBe(false);
    expect(replyView(blank)).toBe("pending");
    expect(replyView(active)).toBe("streaming");
    expect(replyView(settled)).toBe("settled");
});

it("ignores tool items without toolCallId and leaves unmatched calls untouched", () => {
    const assistant = protoToItem(
        create(MessageSchema, {
            id: "a-1",
            role: "assistant",
            toolCalls: [{ id: "call-1", name: "read_file", arguments: "{}" }],
        }),
    );
    const orphanTool = protoToItem(
        create(MessageSchema, { id: "t-0", role: "tool", content: "ignored" }),
    );
    const [hydrated] = hydrateToolResults([assistant, orphanTool]);
    expect(hydrated?.toolCalls[0]?.output).toBe("");
});

it("collapses tool-role items while preserving the parentId chain across multi-tool turns", () => {
    const items = hydrateToolResults([
        protoToItem(
            create(MessageSchema, {
                id: "user-1",
                role: "user",
                content: "check files",
            }),
        ),
        protoToItem(
            create(MessageSchema, {
                id: "assistant-1",
                parentId: "user-1",
                role: "assistant",
                toolCalls: [
                    { id: "c1", name: "read_file", arguments: '{"path":"a"}' },
                    { id: "c2", name: "read_file", arguments: '{"path":"b"}' },
                ],
            }),
        ),
        protoToItem(
            create(MessageSchema, {
                id: "tool-1",
                parentId: "assistant-1",
                role: "tool",
                content: "A",
                toolResult: { toolCallId: "c1", isError: false },
            }),
        ),
        protoToItem(
            create(MessageSchema, {
                id: "tool-2",
                parentId: "tool-1",
                role: "tool",
                content: "B",
                toolResult: { toolCallId: "c2", isError: true },
            }),
        ),
        protoToItem(
            create(MessageSchema, {
                id: "assistant-2",
                parentId: "tool-2",
                role: "assistant",
                content: "done",
                status: MessageStatus.DONE,
            }),
        ),
        protoToItem(
            create(MessageSchema, {
                id: "user-2",
                parentId: "dangling-parent",
                role: "user",
                content: "dangling",
            }),
        ),
        protoToItem(
            create(MessageSchema, {
                id: "tool-loop-a",
                parentId: "tool-loop-b",
                role: "tool",
                content: "",
            }),
        ),
        protoToItem(
            create(MessageSchema, {
                id: "tool-loop-b",
                parentId: "tool-loop-a",
                role: "tool",
                content: "",
            }),
        ),
        protoToItem(
            create(MessageSchema, {
                id: "assistant-cycle",
                parentId: "tool-loop-a",
                role: "assistant",
                content: "after cycle",
            }),
        ),
    ]);

    const collapsed = collapseToolItems(items);
    expect(collapsed.map((item) => [item.id, item.parentId])).toEqual([
        ["user-1", undefined],
        ["assistant-1", "user-1"],
        ["assistant-2", "assistant-1"],
        ["user-2", "dangling-parent"],
        ["assistant-cycle", undefined],
    ]);
    expect(collapsed[1]?.toolCalls).toMatchObject([
        { id: "c1", output: "A", isError: false },
        { id: "c2", output: "B", isError: true },
    ]);
});
