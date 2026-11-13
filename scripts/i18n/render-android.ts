import { toAndroidText } from "./message-text.ts";
import type { Language, MessageEntry } from "./message-entry.ts";

export type AndroidResources = Record<Language, string>;

const XML_ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
};

export function renderAndroid(entries: MessageEntry[]): AndroidResources {
    const android = entries.filter((entry) =>
        entry.platforms.includes("android"),
    );
    const names = new Map<string, string>();
    for (const entry of android) {
        const name = androidName(entry.keyPath);
        const previous = names.get(name);
        if (previous !== undefined) {
            throw new Error(
                `${entry.keyPath.join(".")}: Android resource name ${name} is also used by ${previous}`,
            );
        }
        names.set(name, entry.keyPath.join("."));
    }
    return {
        en: resourceFile(android, "en"),
        zh: resourceFile(android, "zh"),
    };
}

function androidName(keyPath: string[]): string {
    return keyPath
        .map((key) =>
            key.replaceAll(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`),
        )
        .join("_");
}

function resourceFile(entries: MessageEntry[], language: Language): string {
    const lines = entries.flatMap((entry) => resourceLines(entry, language));
    return [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<resources>",
        ...lines,
        "</resources>",
        "",
    ].join("\n");
}

function resourceLines(entry: MessageEntry, language: Language): string[] {
    const name = androidName(entry.keyPath);
    const text = entry[language];
    if (typeof text === "string") {
        return [
            `    <string name="${name}">${androidText(text, entry)}</string>`,
        ];
    }
    const forms = Object.entries(text).map(
        ([quantity, form]) =>
            `        <item quantity="${quantity}">${androidText(form, entry)}</item>`,
    );
    return [`    <plurals name="${name}">`, ...forms, "    </plurals>"];
}

function androidText(text: string, entry: MessageEntry): string {
    return toAndroidText(text, entry.params).replaceAll(
        /[&<>]/gu,
        (character) => XML_ESCAPES[character] ?? character,
    );
}
