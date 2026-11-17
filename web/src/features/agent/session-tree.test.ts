import { describe, expect, it } from "vitest";

import { buildSessionTree } from "./session-tree";
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

describe("buildSessionTree", () => {
    it("returns empty tree for empty messages", () => {
        expect(buildSessionTree([], undefined)).toEqual({
            rows: [],
            pathCount: 0,
        });
    });

    it("collapses assistant-tool-assistant chains and formats TreePaneRow metadata", () => {
        const atMs = new Date(2026, 9, 31, 8, 9).getTime();
        const messages = [
            msg("u1", "user", { content: "read a", createdAtMs: atMs }),
            msg("a1", "assistant", { parentId: "u1", content: "" }),
            msg("t1", "tool", { parentId: "a1", content: "A" }),
            msg("t2", "tool", { parentId: "t1", content: "B" }),
            msg("a2", "assistant", {
                parentId: "t2",
                content: "Done reading.",
                label: "settled",
            }),
        ];

        const tree = buildSessionTree(messages, "a2");

        expect(tree.pathCount).toBe(1);
        expect(tree.rows).toEqual([
            {
                id: "u1",
                kind: "question",
                title: "read a",
                label: undefined,
                meta: "08:09",
                rails: [],
                hasTopSpine: false,
                hasBottomSpine: true,
                onPath: true,
                isLeaf: false,
            },
            {
                id: "a2",
                kind: "answer",
                title: "Done reading.",
                label: "settled",
                meta: "m1",
                rails: [],
                hasTopSpine: true,
                hasBottomSpine: false,
                onPath: true,
                isLeaf: true,
            },
        ]);
    });

    it("lays out fork rails with active-first sorting across branches and roots", () => {
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

        const tree = buildSessionTree(messages, "a2b");

        expect(tree.pathCount).toBe(4);
        expect(
            tree.rows.map((r) => ({
                id: r.id,
                rails: r.rails,
                top: r.hasTopSpine,
                bottom: r.hasBottomSpine,
                onPath: r.onPath,
                leaf: r.isLeaf,
            })),
        ).toEqual([
            {
                id: "u1",
                rails: ["tee"],
                top: false,
                bottom: true,
                onPath: true,
                leaf: false,
            },
            {
                id: "t1",
                rails: ["bar"],
                top: true,
                bottom: true,
                onPath: true,
                leaf: false,
            },
            {
                id: "u2b",
                rails: ["bar", "tee"],
                top: false,
                bottom: true,
                onPath: true,
                leaf: false,
            },
            {
                id: "a2b",
                rails: ["bar", "bar"],
                top: true,
                bottom: false,
                onPath: true,
                leaf: true,
            },
            {
                id: "u2a",
                rails: ["bar", "tee"],
                top: false,
                bottom: true,
                onPath: false,
                leaf: false,
            },
            {
                id: "a2a",
                rails: ["bar", "bar"],
                top: true,
                bottom: false,
                onPath: false,
                leaf: true,
            },
            {
                id: "u2c",
                rails: ["bar", "tee"],
                top: false,
                bottom: false,
                onPath: false,
                leaf: true,
            },
            {
                id: "u0",
                rails: ["tee"],
                top: false,
                bottom: false,
                onPath: false,
                leaf: true,
            },
        ]);
    });

    it("handles dangling parents, model-less clock fallback, and orphan tool nodes", () => {
        const atMs = new Date(2026, 9, 31, 9, 4).getTime();
        const messages = [
            msg("d1", "user", { parentId: "missing", content: "dangling" }),
            msg("a1", "assistant", {
                parentId: "d1",
                content: "",
                model: "",
                createdAtMs: atMs,
            }),
            msg("t1", "tool", { parentId: "a1", content: "" }),
        ];
        const tree = buildSessionTree(messages, "t1");
        expect(tree.rows.map((r) => [r.id, r.title, r.meta])).toEqual([
            ["d1", "dangling", undefined],
            ["t1", "", "09:04"],
        ]);

        const orphanTool = [msg("t0", "tool", { content: "orphan" })];
        const orphanTree = buildSessionTree(orphanTool, undefined);
        expect(orphanTree.rows[0]?.id).toBe("t0");
    });
});
