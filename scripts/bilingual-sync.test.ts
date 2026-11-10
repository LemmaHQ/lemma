import assert from "node:assert/strict";
import test from "node:test";
import type { ItemText, Language, Translator } from "./bilingual-sync.ts";
import { formatBody, parseBody, syncItem } from "./bilingual-sync.ts";

function translatorFor(language: Language): Translator & { calls: string[] } {
    const calls: string[] = [];
    return {
        calls,
        classify: (text) => {
            calls.push(`classify ${text}`);
            return Promise.resolve(language);
        },
        translate: (text, target) => {
            calls.push(`${target} ${text}`);
            return Promise.resolve(`[${target}] ${text}`);
        },
    };
}

async function rewritten(
    item: ItemText,
    source: Language | Translator,
): Promise<ItemText> {
    const next = await syncItem(
        item,
        typeof source === "string" ? translatorFor(source) : source,
    );
    assert.ok(next !== undefined, "the item is rewritten");
    return next;
}

void test("keeps a Chinese source word for word in the collapsed block", async () => {
    const next = await rewritten({ title: "标题", body: "正文" }, "zh");
    assert.equal(next.title, "[en] 标题");
    const stored = parseBody(next.body);
    assert.equal(stored?.en, "[en] 正文");
    assert.equal(stored?.zh, "正文");
    assert.equal(stored?.zhTitle, "标题");
});

void test("leaves an English source untouched and adds the Chinese block", async () => {
    const next = await rewritten({ title: "Title", body: "Body" }, "en");
    assert.equal(next.title, "Title");
    const stored = parseBody(next.body);
    assert.equal(stored?.en, "Body");
    assert.equal(stored?.zh, "[zh] Body");
    assert.equal(stored?.zhTitle, "[zh] Title");
});

void test("translates a source in another language both ways", async () => {
    const next = await rewritten({ body: "本文" }, "other");
    const stored = parseBody(next.body);
    assert.equal(stored?.en, "[en] 本文");
    assert.equal(stored?.zh, "[zh] 本文");
});

void test("does nothing to an item it already rewrote", async () => {
    const first = await rewritten({ title: "Title", body: "Body" }, "en");
    const translator = translatorFor("en");
    assert.equal(await syncItem(first, translator), undefined);
    assert.deepEqual(translator.calls, []);
});

void test("regenerates the Chinese part after the English part changes", async () => {
    const first = await rewritten({ title: "Title", body: "Body" }, "en");
    const edited = { ...first, body: first.body.replace("Body", "New body") };
    const stored = parseBody((await rewritten(edited, "en")).body);
    assert.equal(stored?.en, "New body");
    assert.equal(stored?.zh, "[zh] New body");
    assert.equal(stored?.zhTitle, "[zh] Title");
});

void test("regenerates the English part after only the Chinese part changes", async () => {
    const first = await rewritten({ title: "Title", body: "Body" }, "en");
    const edited = {
        ...first,
        body: first.body.replace("[zh] Body", "新的正文"),
    };
    const next = await rewritten(edited, "en");
    const stored = parseBody(next.body);
    assert.equal(stored?.en, "[en] 新的正文");
    assert.equal(stored?.zh, "新的正文");
    assert.equal(next.title, "Title");
});

void test("takes the English part as the source when both parts changed", async () => {
    const first = await rewritten({ body: "Body" }, "en");
    const edited = {
        body: first.body
            .replace("Body", "New body")
            .replace("[zh] Body", "新的正文"),
    };
    const stored = parseBody((await rewritten(edited, "en")).body);
    assert.equal(stored?.en, "New body");
    assert.equal(stored?.zh, "[zh] New body");
});

void test("retranslates only the title after a title edit", async () => {
    const first = await rewritten({ title: "Title", body: "Body" }, "en");
    const translator = translatorFor("en");
    const next = await rewritten({ ...first, title: "New title" }, translator);
    assert.equal(parseBody(next.body)?.zhTitle, "[zh] New title");
    assert.deepEqual(translator.calls, ["classify New title", "zh New title"]);
});

void test("gives an empty body a block that carries only the Chinese title", async () => {
    const translator = translatorFor("en");
    const next = await rewritten({ title: "Title", body: "" }, translator);
    const stored = parseBody(next.body);
    assert.equal(stored?.en, "");
    assert.equal(stored?.zhTitle, "[zh] Title");
    assert.equal(stored?.zh, "");
    assert.deepEqual(translator.calls, ["classify Title", "zh Title"]);
});

void test("reads back the parts of a body it formatted", () => {
    const body = formatBody(
        { en: "Title", zh: "标题" },
        { en: "First.\n\nSecond.", zh: "第一。\n\n第二。" },
    );
    const stored = parseBody(body);
    assert.equal(stored?.en, "First.\n\nSecond.");
    assert.equal(stored?.zhTitle, "标题");
    assert.equal(stored?.zh, "第一。\n\n第二。");
});

void test("reads a body GitHub returns with CRLF line endings", () => {
    const body = formatBody(undefined, { en: "Text", zh: "文本" });
    assert.equal(parseBody(body.replaceAll("\n", "\r\n"))?.zh, "文本");
});

void test("keeps a collapsed block of the Chinese text inside the Chinese part", () => {
    const zh =
        "前文\n\n<details>\n<summary>日志</summary>\n\n内容\n\n</details>";
    const body = formatBody(undefined, { en: "Text", zh });
    assert.equal(parseBody(body)?.zh, zh);
});

void test("keeps angle brackets and ampersands of the Chinese title", () => {
    const body = formatBody(
        { en: "Use Vec<T> & co", zh: "使用 Vec<T> & 其他" },
        { en: "Text", zh: "文本" },
    );
    assert.ok(
        body.includes("<summary>中文：使用 Vec&lt;T&gt; &amp; 其他</summary>"),
        "the summary line is escaped",
    );
    assert.equal(parseBody(body)?.zhTitle, "使用 Vec<T> & 其他");
});

void test("reads a body without the marker as not rewritten", () => {
    const body = formatBody(undefined, { en: "Text", zh: "文本" });
    assert.equal(parseBody(body.slice(0, body.lastIndexOf("<!--"))), undefined);
    assert.equal(parseBody("Plain text"), undefined);
});
