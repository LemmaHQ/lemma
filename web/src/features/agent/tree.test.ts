import { describe, expect, it } from "vitest";

import type { AgentItem } from "./agent-item";
import { buildSessionTree, groupTurns, resolveActivePath } from "./tree";

const msg = (
    id: string,
    role: AgentItem["role"],
    patch: Partial<AgentItem> = {},
): AgentItem => ({
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

describe("resolveActivePath", () => {
    it("returns empty for undefined or unknown leafId", () => {
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
        expect(turns[0]).toMatchObject({
            id: "u1",
            terminalId: "t1",
            isStreaming: false,
        });
        expect(turns[0]?.assistantSteps.map((s) => s.id)).toEqual(["a1"]);
        expect(turns[0]?.steps).toHaveLength(1);
        expect(turns[1]).toMatchObject({
            id: "u2",
            terminalId: "u2",
            finalReply: undefined,
            isStreaming: false,
        });
        expect(turns[2]).toMatchObject({
            id: "u3",
            terminalId: "a3",
            isStreaming: true,
        });
    });
});

describe("buildSessionTree", () => {
    it("returns empty tree for empty messages", () => {
        expect(
            buildSessionTree([], undefined, { search: "", filter: "all" }),
        ).toEqual({ rows: [], pathCount: 0 });
    });

    it("collapses assistant-tool-assistant chains and preserves DB terminalId", () => {
        const messages = [
            msg("u1", "user", { content: "read a" }),
            msg("a1", "assistant", { parentId: "u1", content: "" }),
            msg("t1", "tool", { parentId: "a1", content: "A" }),
            msg("t2", "tool", { parentId: "t1", content: "B" }),
            msg("a2", "assistant", {
                parentId: "t2",
                content: "Done reading.",
                label: "settled",
            }),
        ];

        const tree = buildSessionTree(messages, "a2", {
            search: "",
            filter: "all",
        });

        expect(tree.pathCount).toBe(1);
        expect(tree.rows).toEqual([
            {
                id: "u1",
                role: "user",
                text: "read a",
                label: undefined,
                createdAtMs: undefined,
                model: undefined,
                providerId: undefined,
                rails: [],
                hasParentSpine: false,
                hasChildSpine: true,
                onPath: true,
                isLeaf: false,
            },
            {
                id: "a2",
                role: "assistant",
                text: "Done reading.",
                label: "settled",
                createdAtMs: undefined,
                model: "m1",
                providerId: "p1",
                rails: [],
                hasParentSpine: true,
                hasChildSpine: false,
                onPath: true,
                isLeaf: true,
            },
        ]);
    });

    it("lays out r14A rails with active-first sorting across branches and roots", () => {
        const messages = [
            msg("u0", "user", { content: "alt root" }),
            msg("u1", "user", { content: "main root" }),
            msg("a1", "assistant", { parentId: "u1", content: "reply 1" }),
            msg("t1", "tool", { parentId: "a1", content: "tool out" }),
            msg("u2a", "user", { parentId: "t1", content: "branch off" }),
            msg("a2a", "assistant", { parentId: "u2a", error: "failed" }),
            msg("u2c", "user", { parentId: "t1", content: "branch off 2" }),
            msg("u2b", "user", { parentId: "t1", content: "branch active" }),
            msg("a2b", "assistant", {
                parentId: "u2b",
                content: "active leaf",
            }),
        ];

        const tree = buildSessionTree(messages, "a2b", {
            search: "",
            filter: "all",
        });

        expect(tree.pathCount).toBe(4);
        expect(
            tree.rows.map((r) => ({
                id: r.id,
                rails: r.rails,
                top: r.hasParentSpine,
                bottom: r.hasChildSpine,
                onPath: r.onPath,
                leaf: r.isLeaf,
            })),
        ).toEqual([
            {
                id: "u1",
                rails: [{ type: "tee", last: false, active: true }],
                top: false,
                bottom: true,
                onPath: true,
                leaf: false,
            },
            {
                id: "t1",
                rails: [{ type: "bar", active: true }],
                top: true,
                bottom: true,
                onPath: true,
                leaf: false,
            },
            {
                id: "u2b",
                rails: [
                    { type: "bar", active: true },
                    { type: "tee", last: false, active: true },
                ],
                top: false,
                bottom: true,
                onPath: true,
                leaf: false,
            },
            {
                id: "a2b",
                rails: [
                    { type: "bar", active: true },
                    { type: "bar", active: true },
                ],
                top: true,
                bottom: false,
                onPath: true,
                leaf: true,
            },
            {
                id: "u2a",
                rails: [
                    { type: "bar", active: true },
                    { type: "tee", last: false, active: false },
                ],
                top: false,
                bottom: true,
                onPath: false,
                leaf: false,
            },
            {
                id: "a2a",
                rails: [
                    { type: "bar", active: true },
                    { type: "bar", active: false },
                ],
                top: true,
                bottom: false,
                onPath: false,
                leaf: true,
            },
            {
                id: "u2c",
                rails: [
                    { type: "bar", active: true },
                    { type: "tee", last: true, active: false },
                ],
                top: false,
                bottom: false,
                onPath: false,
                leaf: true,
            },
            {
                id: "u0",
                rails: [{ type: "tee", last: true, active: false }],
                top: false,
                bottom: false,
                onPath: false,
                leaf: true,
            },
        ]);
    });

    it("filters by questions, labeled, and search while keeping rail geometry intact", () => {
        const messages = [
            msg("u1", "user", { content: "root q" }),
            msg("a1", "assistant", { parentId: "u1", content: "root a" }),
            msg("u2", "user", {
                parentId: "a1",
                content: "branch one",
                label: "alpha",
            }),
            msg("a2", "assistant", { parentId: "u2", content: "ans one" }),
            msg("u3", "user", { parentId: "a1", content: "branch two" }),
            msg("a3", "assistant", {
                parentId: "u3",
                content: "ans two",
                label: "beta",
            }),
            msg("u4", "user", { parentId: "a3", content: "leaf q" }),
        ];

        const questions = buildSessionTree(messages, "a2", {
            search: "",
            filter: "questions",
        });
        expect(
            questions.rows.map((r) => [r.id, r.rails, r.hasChildSpine]),
        ).toEqual([
            ["u1", [], true],
            ["u2", [{ type: "tee", last: false, active: true }], false],
            ["u3", [{ type: "tee", last: true, active: false }], true],
            ["u4", [{ type: "empty", active: false }], false],
        ]);

        const labeled = buildSessionTree(messages, "a2", {
            search: "BETA",
            filter: "labeled",
        });
        expect(
            labeled.rows.map((r) => [r.id, r.rails, r.hasParentSpine]),
        ).toEqual([["a3", [], false]]);

        const bothLabeled = buildSessionTree(messages, "a2", {
            search: "",
            filter: "labeled",
        });
        expect(bothLabeled.rows.map((r) => [r.id, r.rails])).toEqual([
            ["u2", [{ type: "tee", last: false, active: true }]],
            ["a3", [{ type: "tee", last: true, active: false }]],
        ]);

        const nestedFork = [
            msg("r1", "user", { content: "root" }),
            msg("b1", "user", { parentId: "r1", content: "branch 1" }),
            msg("b1a", "assistant", {
                parentId: "b1",
                content: "leaf 1a",
                label: "one",
            }),
            msg("b1b", "assistant", {
                parentId: "b1",
                content: "leaf 1b",
                label: "two",
            }),
            msg("b2", "user", {
                parentId: "r1",
                content: "branch 2",
                label: "three",
            }),
        ];
        const nested = buildSessionTree(nestedFork, "b1a", {
            search: "",
            filter: "labeled",
        });
        expect(nested.rows.map((r) => [r.id, r.rails])).toEqual([
            [
                "b1a",
                [
                    { type: "bar", active: true },
                    { type: "tee", last: false, active: true },
                ],
            ],
            [
                "b1b",
                [
                    { type: "bar", active: true },
                    { type: "tee", last: true, active: false },
                ],
            ],
            ["b2", [{ type: "tee", last: true, active: false }]],
        ]);
    });

    it("handles dangling parents, assistant-only contentless fallback, and cycles", () => {
        const messages = [
            msg("d1", "user", { parentId: "missing", content: "dangling" }),
            msg("a1", "assistant", { parentId: "d1", content: "" }),
            msg("t1", "tool", { parentId: "a1", content: "" }),
        ];
        const tree = buildSessionTree(messages, "t1", {
            search: "",
            filter: "all",
        });
        expect(tree.rows.map((r) => [r.id, r.text])).toEqual([
            ["d1", "dangling"],
            ["t1", ""],
        ]);

        const orphanTool = [msg("t0", "tool", { content: "orphan" })];
        const orphanTree = buildSessionTree(orphanTool, undefined, {
            search: "",
            filter: "all",
        });
        expect(orphanTree.rows[0]?.id).toBe("t0");
    });
});
