import { isRecord } from "../shared/type-guards.ts";
import { placeholders } from "./message-text.ts";

const ALL_PLATFORMS = ["web", "android", "desktop"] as const;
const ENTRY_KEYS: Record<string, true> = {
    en: true,
    zh: true,
    params: true,
    platforms: true,
    plural: true,
};
const PLURAL_FORMS: Record<Language, readonly string[]> = {
    en: ["one", "other"],
    zh: ["other"],
};

export type Platform = (typeof ALL_PLATFORMS)[number];
export type Language = "en" | "zh";
export type ParameterType = "string" | "number";
export type MessageText = string | Record<string, string>;

export interface MessageEntry {
    keyPath: string[];
    platforms: Platform[];
    params: Record<string, ParameterType>;
    plural?: string;
    en: MessageText;
    zh: MessageText;
}

export function readEntry(
    entry: Record<string, unknown>,
    file: string,
    keyPath: string[],
): MessageEntry {
    for (const key of Object.keys(entry)) {
        if (!ENTRY_KEYS[key]) {
            fail(file, [...keyPath, key], "is not a valid entry key");
        }
    }
    const params = readParams(entry.params, file, keyPath);
    const plural = readPlural(entry.plural, params, file, keyPath);
    const platforms = readPlatforms(entry.platforms, file, keyPath);
    const en = readLanguage(entry.en, "en", plural, file, keyPath);
    const zh = readLanguage(entry.zh, "zh", plural, file, keyPath);
    const message: MessageEntry = { keyPath, platforms, params, en, zh };
    if (plural !== undefined) {
        message.plural = plural;
    }
    validateParams(message, file);
    return message;
}

function readParams(
    value: unknown,
    file: string,
    keyPath: string[],
): Record<string, ParameterType> {
    if (value === undefined) {
        return {};
    }
    if (!isRecord(value)) {
        fail(file, [...keyPath, "params"], "must be a map");
    }
    const params: Record<string, ParameterType> = {};
    for (const [name, type] of Object.entries(value)) {
        if (type !== "string" && type !== "number") {
            fail(file, [...keyPath, "params", name], "has an invalid type");
        }
        params[name] = type;
    }
    return params;
}

function readPlural(
    value: unknown,
    params: Record<string, ParameterType>,
    file: string,
    keyPath: string[],
): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "string") {
        fail(file, [...keyPath, "plural"], "must name a parameter");
    }
    if (params[value] !== "number") {
        fail(
            file,
            [...keyPath, "plural"],
            "must name a declared number parameter",
        );
    }
    return value;
}

function readPlatforms(
    value: unknown,
    file: string,
    keyPath: string[],
): Platform[] {
    if (value === undefined) {
        return [...ALL_PLATFORMS];
    }
    if (!Array.isArray(value)) {
        fail(file, [...keyPath, "platforms"], "must be a list");
    }
    return value.map((platform) => {
        if (!isPlatform(platform)) {
            fail(file, [...keyPath, "platforms"], "has an invalid platform");
        }
        return platform;
    });
}

function readLanguage(
    value: unknown,
    language: Language,
    plural: string | undefined,
    file: string,
    keyPath: string[],
): MessageText {
    if (value === undefined) {
        fail(file, [...keyPath, language], "is required");
    }
    const languagePath = [...keyPath, language];
    if (plural === undefined) {
        if (typeof value !== "string") {
            fail(file, languagePath, "must be a string");
        }
        return value;
    }
    if (!isRecord(value)) {
        fail(file, languagePath, "must contain plural forms");
    }
    const required = PLURAL_FORMS[language];
    for (const form of required) {
        if (!Object.hasOwn(value, form)) {
            fail(file, [...languagePath, form], "plural form is required");
        }
    }
    const forms: Record<string, string> = {};
    for (const [form, text] of Object.entries(value)) {
        if (typeof text !== "string") {
            fail(file, [...languagePath, form], "must be a string");
        }
        forms[form] = text;
    }
    return forms;
}

function validateParams(entry: MessageEntry, file: string): void {
    for (const language of ["en", "zh"] as const) {
        const text = entry[language];
        const forms = typeof text === "string" ? { other: text } : text;
        for (const [form, message] of Object.entries(forms)) {
            for (const param of placeholders(message)) {
                if (!Object.hasOwn(entry.params, param)) {
                    fail(
                        file,
                        [...entry.keyPath, language, form],
                        `uses undeclared parameter {${param}}`,
                    );
                }
            }
        }
        const used = new Set(placeholders(forms.other ?? ""));
        for (const param of Object.keys(entry.params)) {
            if (!used.has(param)) {
                fail(
                    file,
                    [...entry.keyPath, language, "other"],
                    `does not use declared parameter {${param}}`,
                );
            }
        }
    }
}

function isPlatform(value: unknown): value is Platform {
    return ALL_PLATFORMS.some((platform) => platform === value);
}

export function fail(file: string, keyPath: string[], message: string): never {
    const key = keyPath.length > 0 ? keyPath.join(".") : "<root>";
    throw new Error(`${file}: ${key}: ${message}`);
}
