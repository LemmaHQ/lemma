import { describe, expect, it } from "vitest";

import {
    EMPTY_SESSION_SLICE,
    groupTurns,
    nonEmptyId,
    prepareNewTurn,
    prepareResumedTurn,
    resolveActivePath,
} from "./active-path";
import type { UiMessage } from "./ui-message";

const msg = (
    id: string,
    role: UiMessage["role"],
    patch: Partial<UiMessage> = {},
): UiMessage => ({
    id,
    role,
    content: "",
    thinking: "",
    status: "done",
    providerId: role === "assistant" ? "p1" : "",
    model: role === "assistant" ? "m1" : "",
    toolCalls: [],
    ...patch,
});

describe("resolveActivePath and nonEmptyId", () => {
    it("normalizes empty ids and returns empty path for undefined or unknown leafId", () => {
        expect(EMPTY_SESSION_SLICE.streaming).toBe(false);
        expect(nonEmptyId(undefined)).toBeUndefined();
        expect(nonEmptyId("")).toBeUndefined();
        expect(nonEmptyId("id-1")).toBe("id-1");

        const items = [msg("u1", "user", { content: "hi" })];
        expect(resolveActivePath(items, undefined)).toEqual([]);
        expect(resolveActivePath(items, "missing")).toEqual([]);
    });

    it("walks from leaf to root and reverses to oldest-first, guarding cycles", () => {
        const items = [
            msg("u1", "user", { content: "q1" }),
            msg("a1", "assistant", { parentId: "u1", content: "ans1" }),
            msg("a1b", "assistant", { parentId: "u1", content: "alt" }),
            msg("u2", "user", { parentId: "a1", content: "q2" }),
        ];
        expect(resolveActivePath(items, "u2").map((m) => m.id)).toEqual([
            "u1",
            "a1",
            "u2",
        ]);

        const cyclic = [
            msg("c1", "user", { parentId: "c2" }),
            msg("c2", "assistant", { parentId: "c1" }),
        ];
        expect(resolveActivePath(cyclic, "c2").map((m) => m.id)).toEqual([
            "c1",
            "c2",
        ]);
    });
});

describe("groupTurns", () => {
    it("groups turns, preserves tool terminalId, and skips orphan leading messages", () => {
        const path = [
            msg("orphan", "assistant", { content: "ignored" }),
            msg("u1", "user", { content: "first" }),
            msg("a1", "assistant", {
                parentId: "u1",
                toolCalls: [
                    {
                        id: "c1",
                        name: "bash",
                        arguments: '{"command":"ls"}',
                        output: "ok",
                        isError: false,
                        state: "done",
                    },
                ],
            }),
            msg("t1", "tool", { parentId: "a1", toolCallId: "c1" }),
            msg("u2", "user", { parentId: "t1", content: "second" }),
            msg("u3", "user", { parentId: "u2", content: "third" }),
            msg("a3", "assistant", {
                parentId: "u3",
                status: "streaming",
                thinking: "pondering",
            }),
        ];

        const turns = groupTurns(path);

        expect(turns).toHaveLength(3);
        expect(turns[0]).toMatchObject({ id: "u1" });
        expect(turns[0]?.finalReply?.id).toBe("a1");
        expect(turns[0]?.steps).toHaveLength(1);
        expect(turns[1]).toMatchObject({
            id: "u2",
            finalReply: undefined,
        });
        expect(turns[2]).toMatchObject({ id: "u3" });
        expect(turns[2]?.finalReply?.id).toBe("a3");
    });
});

describe("prepareNewTurn and prepareResumedTurn", () => {
    it("builds optimistic entries and strips an active turn subtree on resume", () => {
        const u0 = msg("u0", "user", { content: "prev" });
        const u1 = msg("u1", "user", {
            parentId: "u0",
            content: "live",
            createdAtMs: 1_700_000_000_000,
        });
        const a1 = msg("a1", "assistant", {
            parentId: "u1",
            content: "step 1",
        });
        const t1 = msg("t1", "tool", { parentId: "a1", content: "res" });

        const resumed = prepareResumedTurn([u0, u1, a1, t1], "u1");
        expect(resumed.preTree.map((m) => m.id)).toEqual(["u0"]);
        expect(resumed.baseCount).toBe(1);
        expect(resumed.patch.streaming).toBe(true);
        expect(resumed.patch.turnStartedAtMs).toBe(1_700_000_000_000);

        const missingUser = prepareResumedTurn([u0], "u-missing");
        expect(missingUser.userPlaceholderId).toBe("u-missing");
        expect(missingUser.providerId).toBe("");

        const created = prepareNewTurn([u0], "u0", "p1", "m1", "next");
        expect(created.baseCount).toBe(1);
        expect(created.patch.items).toHaveLength(3);
    });
});
