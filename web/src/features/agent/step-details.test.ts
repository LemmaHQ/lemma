import { describe, expect, it } from "vitest";

import type { AgentItem, ToolCallItem } from "./agent-item";
import { buildTurnSteps, formatToolArgument } from "./step-details";

const assistant = (id: string, patch: Partial<AgentItem> = {}): AgentItem => ({
    id,
    role: "assistant",
    content: "",
    thinking: "",
    status: "done",
    providerId: "p1",
    model: "m1",
    toolCalls: [],
    ...patch,
});

const toolCall = (
    id: string,
    name: string,
    patch: Partial<ToolCallItem> = {},
): ToolCallItem => ({
    id,
    name,
    arguments: "{}",
    output: "",
    isError: false,
    state: "done",
    ...patch,
});

describe("formatToolArgument", () => {
    it.each([
        ["read_file", '{"path":"src/app.ts"}', "src/app.ts"],
        ["write_file", '{"path":"notes.txt","content":"hi"}', "notes.txt"],
        ["bash", '{"command":"git status"}', "git status"],
        ["web_search", '{"query":"lemma architecture"}', "lemma architecture"],
        ["web_fetch", '{"url":"https://example.com"}', "https://example.com"],
        ["custom_tool", '{"x":1}', '{"x":1}'],
        ["read_file", '{"path":""}', '{"path":""}'],
        ["bash", '{"command":42}', '{"command":42}'],
        ["web_search", '{"query":null}', '{"query":null}'],
        ["web_fetch", '{"url":true}', '{"url":true}'],
        ["read_file", "not-json", "not-json"],
        ["read_file", "[1,2]", "[1,2]"],
    ])("formats %s(%s) -> %s", (name, args, expected) => {
        expect(formatToolArgument(name, args)).toBe(expected);
    });
});

describe("buildTurnSteps", () => {
    it("emits thinking steps with prose payload and running state", () => {
        const streaming = assistant("a-1", {
            status: "streaming",
            thinking: "\n  First line\nSecond line",
            thinkingStartedAt: 1000,
        });
        const emptyTimed = assistant("a-2", {
            status: "done",
            thinking: "   \n  ",
            thinkingStartedAt: 1000,
            thinkingFinishedAt: 2000,
        });

        const steps = buildTurnSteps([streaming, emptyTimed]);

        expect(steps[0]).toMatchObject({
            id: "a-1:thinking",
            kind: "thinking",
            argument: "First line",
            plainArgument: true,
            state: "running",
            detail: { kind: "prose", text: "\n  First line\nSecond line" },
        });
        expect(steps[1]).toMatchObject({
            id: "a-2:thinking",
            argument: "",
            state: "done",
        });
    });

    it("formats read_file, write_file, bash, and unknown tool payloads", () => {
        const step = assistant("a-1", {
            toolCalls: [
                toolCall("c1", "read_file", {
                    arguments: '{"path":"src/main.ts"}',
                    output: JSON.stringify("const x = 1;\nconst y = 2;"),
                }),
                toolCall("c2", "read_file", {
                    arguments: '{"path":"Makefile"}',
                    output: "all:",
                }),
                toolCall("c2b", "read_file", {
                    arguments: '{"path":"count.txt"}',
                    output: "123",
                }),
                toolCall("c3", "write_file", {
                    arguments: '{"path":"README.md","content":"# Hello"}',
                    output: '{"success":true}',
                }),
                toolCall("c4", "write_file", {
                    arguments: '{"path":"a.txt"}',
                    output: '{"success":true}',
                }),
                toolCall("c5", "write_file", {
                    arguments: "bad-json",
                    output: "ok",
                }),
                toolCall("c6", "bash", {
                    arguments: '{"command":"ls"}',
                    output: JSON.stringify({
                        exit_code: 0,
                        stdout: "file.txt",
                        stderr: "warn",
                        stopped: "timeout",
                    }),
                }),
                toolCall("c7", "bash", {
                    arguments: '{"command":"false"}',
                    output: JSON.stringify({ exit_code: 2 }),
                }),
                toolCall("c8", "bash", {
                    arguments: '{"command":"true"}',
                    output: JSON.stringify({ exit_code: 0 }),
                }),
                toolCall("c9", "bash", {
                    arguments: '{"command":"echo hi"}',
                    output: "plain text",
                }),
                toolCall("c10", "custom", {
                    arguments: "{}",
                    output: "custom output",
                }),
                toolCall("c11", "read_file", {
                    arguments: '{"path":"a.ts"}',
                    output: "",
                    state: "running",
                }),
            ],
        });

        const steps = buildTurnSteps([step]);

        expect(steps[0]).toMatchObject({
            detail: {
                kind: "code",
                code: "const x = 1;\nconst y = 2;",
                language: "ts",
            },
        });
        expect(steps[1]).toMatchObject({
            detail: { kind: "code", code: "all:", language: undefined },
        });
        expect(steps[2]).toMatchObject({
            detail: { kind: "code", code: "123", language: undefined },
        });
        expect(steps[3]).toMatchObject({
            detail: { kind: "code", code: "# Hello", language: "markdown" },
        });
        expect(steps[4]).toMatchObject({
            detail: { kind: "output", text: '{"success":true}' },
        });
        expect(steps[5]).toMatchObject({
            detail: { kind: "output", text: "ok" },
        });
        expect(steps[6]).toMatchObject({
            detail: { kind: "output", text: "file.txt\nwarn\n[timeout]" },
        });
        expect(steps[7]).toMatchObject({
            detail: { kind: "output", text: "exit 2" },
        });
        expect(steps[8]).toMatchObject({
            detail: { kind: "output", text: "" },
        });
        expect(steps[9]).toMatchObject({
            detail: { kind: "output", text: "plain text" },
        });
        expect(steps[10]).toMatchObject({
            detail: { kind: "output", text: "custom output" },
        });
        expect(steps[11]).toMatchObject({
            state: "running",
            detail: { kind: "output", text: "" },
        });
    });

    it("parses web_search and web_fetch JSON outputs with via and fallback", () => {
        const step = assistant("a-1", {
            toolCalls: [
                toolCall("s1", "web_search", {
                    arguments: '{"query":"rust"}',
                    output: JSON.stringify({
                        provider: "exa",
                        note: "Top hits",
                        results: [
                            "skip-non-object",
                            null,
                            {
                                title: "Rust",
                                url: "https://rust-lang.org",
                                snippet: "Systems language",
                            },
                            {
                                url: "https://doc.rust-lang.org",
                                summary: "Docs summary",
                            },
                            {
                                text: "Fallback text",
                            },
                            {},
                        ],
                    }),
                }),
                toolCall("s2", "web_search", {
                    arguments: '{"query":"bad"}',
                    output: "plain fallback",
                }),
                toolCall("f1", "web_fetch", {
                    arguments: '{"url":"https://a.com"}',
                    output: JSON.stringify({
                        provider: "deepseek",
                        title: "Title",
                        content: "Body",
                    }),
                }),
                toolCall("f2", "web_fetch", {
                    arguments: '{"url":"https://b.com"}',
                    output: JSON.stringify({ text: "Only text" }),
                }),
                toolCall("f3", "web_fetch", {
                    arguments: '{"url":"https://c.com"}',
                    output: JSON.stringify({ title: "Only title" }),
                }),
                toolCall("f4", "web_fetch", {
                    arguments: '{"url":"https://d.com"}',
                    output: JSON.stringify({}),
                }),
                toolCall("f5", "web_fetch", {
                    arguments: '{"url":"https://e.com"}',
                    output: "raw fetch",
                }),
            ],
        });

        const steps = buildTurnSteps([step]);

        expect(steps[0]).toMatchObject({
            plainArgument: true,
            via: "exa",
            detail: {
                kind: "web",
                note: "Top hits",
                hits: [
                    {
                        title: "Rust",
                        url: "https://rust-lang.org",
                        snippet: "Systems language",
                    },
                    {
                        title: "https://doc.rust-lang.org",
                        url: "https://doc.rust-lang.org",
                        snippet: "Docs summary",
                    },
                    {
                        title: "",
                        url: "",
                        snippet: "Fallback text",
                    },
                    {
                        title: "",
                        url: "",
                        snippet: "",
                    },
                ],
            },
        });
        expect(steps[1]).toMatchObject({
            via: undefined,
            detail: { kind: "output", text: "plain fallback" },
        });
        expect(steps[2]).toMatchObject({
            via: "deepseek",
            detail: { kind: "output", text: "Title\n\nBody" },
        });
        expect(steps[3]).toMatchObject({
            detail: { kind: "output", text: "Only text" },
        });
        expect(steps[4]).toMatchObject({
            detail: { kind: "output", text: "Only title" },
        });
        expect(steps[5]).toMatchObject({
            detail: { kind: "output", text: "{}" },
        });
        expect(steps[6]).toMatchObject({
            detail: { kind: "output", text: "raw fetch" },
        });
    });

    it("detects self-healed tool errors vs unrecovered failures", () => {
        const sameTurnFixed = buildTurnSteps([
            assistant("a-1", {
                toolCalls: [
                    toolCall("c1", "read_file", {
                        arguments: '{"path":"missing.txt"}',
                        output: "not found",
                        isError: true,
                    }),
                    toolCall("c2", "read_file", {
                        arguments: '{"path":"found.txt"}',
                        output: "ok",
                        isError: false,
                    }),
                ],
            }),
        ]);
        expect(sameTurnFixed[0]).toMatchObject({
            isError: true,
            selfHealed: true,
            warn: true,
            detail: { kind: "output", text: "not found" },
        });
        expect(sameTurnFixed[1]).toMatchObject({
            isError: false,
            selfHealed: false,
            warn: false,
        });

        const nextStepDone = buildTurnSteps([
            assistant("a-1", {
                toolCalls: [
                    toolCall("c1", "bash", {
                        arguments: '{"command":"bad"}',
                        output: "failed",
                        isError: true,
                    }),
                ],
            }),
            assistant("a-2", { status: "done", content: "Recovered anyway." }),
        ]);
        expect(nextStepDone[0]).toMatchObject({
            isError: true,
            selfHealed: true,
            warn: true,
        });

        const unrecovered = buildTurnSteps([
            assistant("a-1", {
                toolCalls: [
                    toolCall("c1", "bash", {
                        arguments: '{"command":"bad"}',
                        output: "boom",
                        isError: true,
                    }),
                ],
            }),
            assistant("a-2", { status: "error", error: "aborted" }),
        ]);
        expect(unrecovered[0]).toMatchObject({
            isError: true,
            selfHealed: false,
            warn: true,
        });
    });
});
