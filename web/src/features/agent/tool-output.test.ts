import { describe, expect, it } from "vitest";

import type { ToolCallItem } from "./agent-item";
import {
    lastPathSegment,
    nonEmptyString,
    parseJsonObject,
    parseToolOutput,
} from "./tool-output";

const call = (name: string, output: string, isError = false): ToolCallItem => ({
    id: "c1",
    name,
    arguments: "{}",
    output,
    isError,
    state: "done",
});

describe("tool-output", () => {
    it("extracts path segments and validates non-empty strings and plain JSON objects", () => {
        expect(lastPathSegment("C:\\work\\project\\main.rs")).toBe("main.rs");
        expect(lastPathSegment("/usr/local/bin/")).toBe("bin");
        expect(lastPathSegment("plain")).toBe("plain");
        expect(lastPathSegment("/")).toBe("/");

        expect(nonEmptyString("ok")).toBe("ok");
        expect(nonEmptyString("")).toBeUndefined();
        expect(nonEmptyString(42)).toBeUndefined();

        expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
        expect(parseJsonObject("[1,2]")).toBeNull();
        expect(parseJsonObject("invalid")).toBeNull();
    });

    it("formats read_file, write_file, bash, web_search, web_fetch, and fallback outputs", () => {
        expect(
            parseToolOutput(call("read_file", "fn main() {}"), "src/lib.rs"),
        ).toEqual({
            detail: { kind: "code", code: "fn main() {}", language: "rust" },
        });
        expect(
            parseToolOutput(call("read_file", "not found", true), "src/lib.rs"),
        ).toEqual({
            detail: { kind: "output", text: "not found" },
        });
        expect(
            parseToolOutput(call("write_file", "wrote 10 bytes"), "README"),
        ).toEqual({
            detail: { kind: "output", text: "wrote 10 bytes" },
        });

        expect(
            parseToolOutput(
                call(
                    "bash",
                    JSON.stringify({
                        stdout: "out",
                        stderr: "err",
                        stopped: "timeout",
                    }),
                ),
                "ls",
            ),
        ).toEqual({
            detail: { kind: "output", text: "out\nerr\n[timeout]" },
        });
        expect(
            parseToolOutput(
                call("bash", JSON.stringify({ exit_code: 2 })),
                "false",
            ),
        ).toEqual({
            detail: { kind: "output", text: "exit 2" },
        });
        expect(parseToolOutput(call("bash", "raw output"), "echo")).toEqual({
            detail: { kind: "output", text: "raw output" },
        });

        expect(
            parseToolOutput(
                call(
                    "web_search",
                    JSON.stringify({
                        provider: "exa",
                        note: "Showing top result",
                        results: [
                            null,
                            {
                                title: "Docs",
                                url: "https://example.com",
                                summary: "Summary text",
                            },
                        ],
                    }),
                ),
                "lemma",
            ),
        ).toEqual({
            via: "exa",
            detail: {
                kind: "web",
                note: "Showing top result",
                hits: [
                    {
                        title: "Docs",
                        url: "https://example.com",
                        snippet: "Summary text",
                    },
                ],
            },
        });
        expect(
            parseToolOutput(call("web_search", "unstructured"), "lemma"),
        ).toEqual({
            detail: { kind: "output", text: "unstructured" },
        });

        expect(
            parseToolOutput(
                call(
                    "web_fetch",
                    JSON.stringify({
                        provider: "native",
                        title: "Page",
                        content: "Body",
                    }),
                ),
                "https://example.com",
            ),
        ).toEqual({
            via: "native",
            detail: { kind: "output", text: "Page\n\nBody" },
        });

        expect(parseToolOutput(call("custom_tool", "done"), "")).toEqual({
            detail: { kind: "output", text: "done" },
        });
    });
});
