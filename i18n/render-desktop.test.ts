import assert from "node:assert/strict";
import test from "node:test";
import { readI18nSource } from "./read-i18n.ts";
import { renderDesktop } from "./render-desktop.ts";

function render(source: unknown): string {
    return renderDesktop(readI18nSource(source, "fixture.yaml"));
}

void test("renders static and parameterized functions in nested modules", () => {
    const output = render({
        auth: {
            signIn: { en: "Sign in", zh: "登录" },
        },
        version: {
            server: {
                params: { version: "string" },
                en: "Server v{version}",
                zh: "服务端 v{version}",
            },
        },
    });
    assert.match(output, /#\[derive\(Debug, Clone, Copy, PartialEq, Eq\)\]/u);
    assert.match(output, /pub mod auth \{/u);
    assert.match(output, /\/\/\/ Sign in/u);
    assert.match(
        output,
        /#\[must_use\]\n    pub fn sign_in\(language: Language\) -> &'static str/u,
    );
    assert.match(output, /Language::En => "Sign in"/u);
    assert.match(output, /Language::Zh => "登录"/u);
    assert.match(
        output,
        /pub fn server\(language: Language, version: &str\) -> String/u,
    );
    assert.match(output, /format!\("Server v\{version\}"\)/u);
});

void test("selects English plurals and always uses Chinese other", () => {
    const output = render({
        provider: {
            addPicked: {
                plural: "count",
                params: { count: "number" },
                en: { one: "Add {count} model", other: "Add {count} models" },
                zh: { other: "添加 {count} 个模型" },
            },
        },
    });
    assert.match(
        output,
        /pub fn add_picked\(language: Language, count: usize\) -> String/u,
    );
    assert.match(
        output,
        /Language::En if count == 1 => format!\("Add \{count\} model"\)/u,
    );
    assert.match(output, /Language::En => format!\("Add \{count\} models"\)/u);
    assert.match(output, /Language::Zh => format!\("添加 \{count\} 个模型"\)/u);
});

void test("normalizes parameters and preserves literal braces", () => {
    const output = render({
        provider: {
            apiPath: {
                params: { modelName: "string", type: "string" },
                en: "Use \\{model\\} with {modelName} as {type}",
                zh: "将 {modelName} 作为 {type} 用于 \\{model\\}",
            },
        },
    });
    assert.match(output, /model_name: &str, r#type: &str/u);
    assert.match(
        output,
        /format!\("Use \{\{model\}\} with \{model_name\} as \{type\}"\)/u,
    );
});

void test("emits raw identifiers for Rust keywords", () => {
    const output = render({
        auth: {
            continue: { en: "Continue", zh: "继续" },
        },
    });
    assert.match(output, /pub fn r#continue\(language: Language\)/u);
});

void test("selects desktop entries and defaults omitted platforms to all", () => {
    const output = render({
        common: {
            shared: { en: "Shared", zh: "共享" },
            web: { platforms: ["web"], en: "Web", zh: "网页" },
            desktop: {
                platforms: ["desktop"],
                en: "Desktop",
                zh: "桌面",
            },
        },
    });
    assert.match(output, /pub fn shared/u);
    assert.match(output, /pub fn desktop/u);
    assert.doesNotMatch(output, /pub fn web/u);
});

void test("rejects name collisions after snake case conversion", () => {
    assert.throws(
        () =>
            render({
                common: {
                    fooBar: { en: "One", zh: "一" },
                    foo_bar: { en: "Two", zh: "二" },
                },
            }),
        /common.foo_bar: desktop name collision at common.foo_bar/u,
    );
});

void test("rejects a function and module with the same name", () => {
    assert.throws(
        () =>
            render({
                session: {
                    save: { en: "Save", zh: "保存" },
                },
                Session: {
                    save: {
                        title: { en: "Save session", zh: "保存会话" },
                    },
                },
            }),
        /Session.save.title: desktop name collision at session.save/u,
    );
});

void test("rejects identifiers that cannot be raw and parameter collisions", () => {
    assert.throws(
        () => render({ common: { crate: { en: "Crate", zh: "Crate" } } }),
        /common.crate: crate cannot be a raw desktop identifier/u,
    );
    assert.throws(
        () =>
            render({
                common: {
                    message: {
                        params: { language: "string" },
                        en: "{language}",
                        zh: "{language}",
                    },
                },
            }),
        /common.message: duplicate desktop parameter name language/u,
    );
});
