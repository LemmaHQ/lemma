import assert from "node:assert/strict";
import test from "node:test";
import { readI18nSource } from "./read-i18n.ts";
import { renderAndroid } from "./render-android.ts";
import type { AndroidResources } from "./render-android.ts";

function render(source: unknown): AndroidResources {
    return renderAndroid(readI18nSource(source, "fixture.yaml"));
}

function resources(...lines: string[]): string {
    return [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<resources>",
        ...lines,
        "</resources>",
        "",
    ].join("\n");
}

void test("names resources by key path and numbers parameters by declaration order", () => {
    const android = render({
        agent: {
            toolCall: {
                failed: {
                    platforms: ["android"],
                    params: { name: "string", count: "number" },
                    en: "{name} failed {count} times",
                    zh: "{name} 失败了 {count} 次",
                },
            },
        },
    });
    assert.deepEqual(android, {
        en: resources(
            '    <string name="agent_tool_call_failed">%1$s failed %2$d times</string>',
        ),
        zh: resources(
            '    <string name="agent_tool_call_failed">%1$s 失败了 %2$d 次</string>',
        ),
    });
});

void test("renders plural entries with the forms each language defines", () => {
    const android = render({
        provider: {
            addPicked: {
                platforms: ["android"],
                plural: "count",
                params: { count: "number" },
                en: { one: "Add {count} model", other: "Add {count} models" },
                zh: { other: "添加 {count} 个模型" },
            },
        },
    });
    assert.deepEqual(android, {
        en: resources(
            '    <plurals name="provider_add_picked">',
            '        <item quantity="one">Add %1$d model</item>',
            '        <item quantity="other">Add %1$d models</item>',
            "    </plurals>",
        ),
        zh: resources(
            '    <plurals name="provider_add_picked">',
            '        <item quantity="other">添加 %1$d 个模型</item>',
            "    </plurals>",
        ),
    });
});

void test("keeps literal braces and escapes backslashes and XML markup", () => {
    const android = render({
        provider: {
            apiPath: {
                platforms: ["android"],
                en: "Use \\{model\\} & <path> in C:\\dir",
                zh: "使用 \\{model\\}",
            },
        },
    });
    assert.equal(
        android.en,
        resources(
            '    <string name="provider_api_path">Use {model} &amp; &lt;path&gt; in C:\\\\dir</string>',
        ),
    );
});

void test("selects Android entries and defaults an omitted platform list to all", () => {
    const android = render({
        common: {
            shared: { en: "Shared", zh: "共享" },
            web: { platforms: ["web"], en: "Web", zh: "网页" },
            android: { platforms: ["android"], en: "Android", zh: "安卓" },
        },
    });
    assert.equal(
        android.en,
        resources(
            '    <string name="common_shared">Shared</string>',
            '    <string name="common_android">Android</string>',
        ),
    );
});

void test("rejects two keys that map to one resource name", () => {
    assert.throws(
        () =>
            render({
                session: {
                    listTitle: { platforms: ["android"], en: "A", zh: "甲" },
                    list_title: { platforms: ["android"], en: "B", zh: "乙" },
                },
            }),
        /session\.list_title: Android resource name session_list_title is also used by session\.listTitle/u,
    );
});
