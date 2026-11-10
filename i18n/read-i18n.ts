import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { fail, readEntry } from "./message-entry.ts";
import type { MessageEntry } from "./message-entry.ts";
import { isRecord } from "./type-guards.ts";

export function readI18nSources(directory: string): MessageEntry[] {
    const files = fs
        .readdirSync(directory)
        .filter(
            (file) => file.endsWith(".yaml") && !file.endsWith(".i18n.yaml"),
        )
        .toSorted();
    return files.flatMap((file) => {
        const filePath = path.join(directory, file);
        const source: unknown = parse(fs.readFileSync(filePath, "utf8"));
        return readI18nSource(source, filePath);
    });
}

export function readI18nSource(
    source: unknown,
    file: string,
): MessageEntry[] {
    if (!isRecord(source)) {
        fail(file, [], "must contain a message tree");
    }
    const entries: MessageEntry[] = [];
    readGroup(source, file, [], entries);
    return entries;
}

function readGroup(
    group: Record<string, unknown>,
    file: string,
    prefix: string[],
    entries: MessageEntry[],
): void {
    for (const [key, value] of Object.entries(group)) {
        const keyPath = [...prefix, key];
        if (!isRecord(value)) {
            fail(file, keyPath, "must be a group or message entry");
        }
        if (Object.hasOwn(value, "en") || Object.hasOwn(value, "zh")) {
            entries.push(readEntry(value, file, keyPath));
        } else {
            readGroup(value, file, keyPath, entries);
        }
    }
}
