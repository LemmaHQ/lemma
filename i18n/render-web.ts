import { toWebText } from "./message-text.ts";
import type { Language, MessageEntry } from "./message-entry.ts";

export interface WebMessages {
    [key: string]: string | WebMessages;
}

export type WebLocales = Record<Language, WebMessages>;

export function renderWeb(entries: MessageEntry[]): WebLocales {
    const locales: WebLocales = { en: {}, zh: {} };
    for (const entry of entries) {
        if (!entry.platforms.includes("web")) {
            continue;
        }
        for (const language of ["en", "zh"] as const) {
            addMessage(locales[language], entry, language);
        }
    }
    return locales;
}

function addMessage(
    locale: WebMessages,
    entry: MessageEntry,
    language: Language,
): void {
    const group = entry.keyPath
        .slice(0, -1)
        .reduce<WebMessages>(messageGroup, locale);
    const key = entry.keyPath.at(-1) ?? "";
    const text = entry[language];
    if (typeof text === "string") {
        group[key] = toWebText(text);
        return;
    }
    for (const form of ["one", "other"] as const) {
        group[`${key}_${form}`] = toWebText(text[form] ?? text.other ?? "");
    }
}

function messageGroup(group: WebMessages, key: string): WebMessages {
    const child = group[key];
    if (typeof child === "object") {
        return child;
    }
    const nested: WebMessages = {};
    group[key] = nested;
    return nested;
}
