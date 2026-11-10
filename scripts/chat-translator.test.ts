import assert from "node:assert/strict";
import test from "node:test";
import {
    extractFencedCode,
    restoreFencedCode,
    spanProblems,
} from "./chat-translator.ts";

const TEXT = [
    "Before",
    "",
    "```rust",
    "let x = 1;",
    "```",
    "",
    "- item",
    "",
    "    ~~~~",
    "    ``` inside",
    "    ~~~~",
    "",
    "After",
].join("\n");

void test("puts fenced code back where its placeholder stands", () => {
    const { text, blocks } = extractFencedCode(TEXT);
    assert.equal(blocks.length, 2);
    assert.ok(!text.includes("let x"), "the code is out of the text");
    assert.equal(restoreFencedCode(text, blocks), TEXT);
});

void test("takes an unclosed fence to run to the end of the text", () => {
    const { text, blocks } = extractFencedCode("Before\n```\ncode");
    assert.equal(text, "Before\n[[CODE_BLOCK_0]]");
    assert.deepEqual(blocks, ["```\ncode"]);
});

void test("rejects a translation that dropped, repeated, or invented a placeholder", () => {
    const blocks = ["```\ncode\n```"];
    assert.throws(() => restoreFencedCode("no placeholder", blocks), /0 of 1/u);
    assert.throws(
        () => restoreFencedCode("[[CODE_BLOCK_0]] [[CODE_BLOCK_0]]", blocks),
        /unexpected/u,
    );
    assert.throws(
        () => restoreFencedCode("[[CODE_BLOCK_0]] [[CODE_BLOCK_1]]", blocks),
        /unexpected/u,
    );
});

void test("reports inline code and URLs that differ between source and translation", () => {
    const source =
        "Call `run()` with ``a ` b``, see https://example.com/a?b=1.";
    assert.deepEqual(
        spanProblems(
            source,
            "用 ``a ` b`` 调用 `run()`，见 https://example.com/a?b=1。",
        ),
        [],
    );
    assert.deepEqual(
        spanProblems(source, "调用 `运行()`，见 https://example.com/a"),
        [
            "translation lost `run()`",
            "translation lost ``a ` b``",
            "translation lost https://example.com/a?b=1",
            "translation added `运行()`",
            "translation added https://example.com/a",
        ],
    );
});
