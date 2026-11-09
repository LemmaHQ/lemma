import assert from "node:assert/strict";
import test from "node:test";
import { readI18nSource } from "./read-i18n.ts";
import { renderWeb } from "./render-web.ts";
import type { WebLocales } from "./render-web.ts";

function render(source: unknown): WebLocales {
    return renderWeb(readI18nSource(source, "fixture.yaml"));
}

void test("converts declared placeholders to i18next interpolation", () => {
    const locales = render({
        version: {
            server: {
                params: { version: "string" },
                en: "Server v{version}",
                zh: "服务端 v{version}",
            },
        },
    });
    assert.deepEqual(locales, {
        en: { version: { server: "Server v{{version}}" } },
        zh: { version: { server: "服务端 v{{version}}" } },
    });
});

void test("expands plural entries into i18next one and other keys", () => {
    const locales = render({
        provider: {
            addPicked: {
                plural: "count",
                params: { count: "number" },
                en: { one: "Add {count} model", other: "Add {count} models" },
                zh: { other: "添加 {count} 个模型" },
            },
        },
    });
    assert.deepEqual(locales, {
        en: {
            provider: {
                addPicked_one: "Add {{count}} model",
                addPicked_other: "Add {{count}} models",
            },
        },
        zh: {
            provider: {
                addPicked_one: "添加 {{count}} 个模型",
                addPicked_other: "添加 {{count}} 个模型",
            },
        },
    });
});

void test("turns escaped braces into literal braces", () => {
    const locales = render({
        provider: {
            apiPath: {
                en: "Use \\{model\\} in {path}",
                zh: "在 {path} 中使用 \\{model\\}",
                params: { path: "string" },
            },
        },
    });
    assert.deepEqual(locales, {
        en: { provider: { apiPath: "Use {model} in {{path}}" } },
        zh: { provider: { apiPath: "在 {{path}} 中使用 {model}" } },
    });
});

void test("selects web entries and defaults an omitted platform list to all", () => {
    const locales = render({
        common: {
            shared: { en: "Shared", zh: "共享" },
            web: { platforms: ["web"], en: "Web", zh: "网页" },
            android: {
                platforms: ["android"],
                en: "Android",
                zh: "安卓",
            },
        },
    });
    assert.deepEqual(locales, {
        en: { common: { shared: "Shared", web: "Web" } },
        zh: { common: { shared: "共享", web: "网页" } },
    });
});
