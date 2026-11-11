import assert from "node:assert/strict";
import test from "node:test";
import { readI18nSource } from "./read-i18n.ts";

interface InvalidCase {
    name: string;
    source: unknown;
    error: string;
}

const invalidCases: InvalidCase[] = [
    {
        name: "rejects a scalar source",
        source: "message",
        error: "fixture.yaml: <root>: must contain a message tree",
    },
    {
        name: "rejects a scalar group child",
        source: { common: { save: "Save" } },
        error: "fixture.yaml: common.save: must be a group or message entry",
    },
    {
        name: "rejects an unknown entry key",
        source: { common: { save: { en: "Save", zh: "保存", id: "save" } } },
        error: "fixture.yaml: common.save.id: is not a valid entry key",
    },
    {
        name: "rejects a missing English message",
        source: { common: { save: { zh: "保存" } } },
        error: "fixture.yaml: common.save.en: is required",
    },
    {
        name: "rejects a missing Chinese message",
        source: { common: { save: { en: "Save" } } },
        error: "fixture.yaml: common.save.zh: is required",
    },
    {
        name: "rejects non-map params",
        source: {
            common: { save: { en: "Save", zh: "保存", params: [] } },
        },
        error: "fixture.yaml: common.save.params: must be a map",
    },
    {
        name: "rejects an unknown parameter type",
        source: {
            common: {
                save: {
                    en: "Save {name}",
                    zh: "保存 {name}",
                    params: { name: "text" },
                },
            },
        },
        error: "fixture.yaml: common.save.params.name: has an invalid type",
    },
    {
        name: "rejects a non-string plural selector",
        source: {
            common: {
                item: {
                    en: { one: "One", other: "Many" },
                    zh: { other: "多个" },
                    plural: 1,
                    params: { count: "number" },
                },
            },
        },
        error: "fixture.yaml: common.item.plural: must name a parameter",
    },
    {
        name: "rejects a plural selector that is not a declared number",
        source: {
            common: {
                item: {
                    en: { one: "One {count}", other: "Many {count}" },
                    zh: { other: "{count} 个" },
                    plural: "count",
                    params: { count: "string" },
                },
            },
        },
        error: "fixture.yaml: common.item.plural: must name a declared number parameter",
    },
    {
        name: "rejects a non-list platform field",
        source: {
            common: { save: { en: "Save", zh: "保存", platforms: "web" } },
        },
        error: "fixture.yaml: common.save.platforms: must be a list",
    },
    {
        name: "rejects an unknown platform",
        source: {
            common: { save: { en: "Save", zh: "保存", platforms: ["ios"] } },
        },
        error: "fixture.yaml: common.save.platforms: has an invalid platform",
    },
    {
        name: "rejects non-string text without a plural selector",
        source: { common: { save: { en: { other: "Save" }, zh: "保存" } } },
        error: "fixture.yaml: common.save.en: must be a string",
    },
    {
        name: "rejects non-map plural text",
        source: {
            common: {
                item: {
                    en: "One {count}",
                    zh: { other: "{count} 个" },
                    plural: "count",
                    params: { count: "number" },
                },
            },
        },
        error: "fixture.yaml: common.item.en: must contain plural forms",
    },
    {
        name: "requires the English one plural form",
        source: {
            common: {
                item: {
                    en: { other: "{count} items" },
                    zh: { other: "{count} 个" },
                    plural: "count",
                    params: { count: "number" },
                },
            },
        },
        error: "fixture.yaml: common.item.en.one: plural form is required",
    },
    {
        name: "requires the English other plural form",
        source: {
            common: {
                item: {
                    en: { one: "{count} item" },
                    zh: { other: "{count} 个" },
                    plural: "count",
                    params: { count: "number" },
                },
            },
        },
        error: "fixture.yaml: common.item.en.other: plural form is required",
    },
    {
        name: "requires the Chinese other plural form",
        source: {
            common: {
                item: {
                    en: { one: "{count} item", other: "{count} items" },
                    zh: {},
                    plural: "count",
                    params: { count: "number" },
                },
            },
        },
        error: "fixture.yaml: common.item.zh.other: plural form is required",
    },
    {
        name: "rejects a non-string plural form",
        source: {
            common: {
                item: {
                    en: { one: 1, other: "{count} items" },
                    zh: { other: "{count} 个" },
                    plural: "count",
                    params: { count: "number" },
                },
            },
        },
        error: "fixture.yaml: common.item.en.one: must be a string",
    },
    {
        name: "rejects an undeclared placeholder",
        source: {
            common: {
                save: { en: "Save {name}", zh: "保存 {name}", params: {} },
            },
        },
        error: "fixture.yaml: common.save.en.other: uses undeclared parameter {name}",
    },
    {
        name: "rejects a declared parameter unused by English other text",
        source: {
            common: {
                save: {
                    en: "Save",
                    zh: "保存 {name}",
                    params: { name: "string" },
                },
            },
        },
        error: "fixture.yaml: common.save.en.other: does not use declared parameter {name}",
    },
    {
        name: "rejects a declared parameter unused by Chinese other text",
        source: {
            common: {
                save: {
                    en: "Save {name}",
                    zh: "保存",
                    params: { name: "string" },
                },
            },
        },
        error: "fixture.yaml: common.save.zh.other: does not use declared parameter {name}",
    },
];

for (const { name, source, error } of invalidCases) {
    void test(name, () => {
        assert.throws(() => readI18nSource(source, "fixture.yaml"), {
            message: error,
        });
    });
}
