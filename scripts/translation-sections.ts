import { createHash } from "node:crypto";

export interface Section {
    level: number;
    title: string;
    start: number;
    lines: string[];
    end: number;
    hash: string | null;
}

export interface Entry {
    key: string;
    index: number;
    en: string;
    zh: string | null;
}

export type EntriesResult =
    | { entries: Entry[]; error?: undefined }
    | { entries?: undefined; error: string };

const FENCE = /^ {0,3}(`{3,}|~{3,})/u;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/u;

export function splitSections(text: string): [Section, ...Section[]] {
    const sections: [Section, ...Section[]] = [
        { level: 0, title: "", start: 1, lines: [], end: 0, hash: null },
    ];
    let fence: string | null = null;
    text.split("\n").forEach((line, index) => {
        const marker = FENCE.exec(line)?.[1];
        if (fence === null) {
            if (marker === undefined) {
                const heading = HEADING.exec(line);
                const hashes = heading?.[1];
                const title = heading?.[2];
                if (hashes !== undefined && title !== undefined) {
                    sections.push({
                        level: hashes.length,
                        title,
                        start: index + 1,
                        lines: [],
                        end: 0,
                        hash: null,
                    });
                }
            } else {
                fence = marker;
            }
        } else if (
            marker !== undefined &&
            marker[0] === fence[0] &&
            marker.length >= fence.length
        ) {
            fence = null;
        }
        const current = sections.at(-1);
        if (current !== undefined) {
            current.lines.push(line);
        }
    });
    for (const section of sections) {
        const body = section.lines
            .map((line) => line.trimEnd())
            .join("\n")
            .replaceAll(/\n{3,}/gu, "\n\n")
            .trim();
        section.end = section.start + section.lines.length - 1;
        section.hash =
            body === ""
                ? null
                : createHash("sha256").update(body).digest("hex").slice(0, 16);
    }
    return sections;
}

const slug = (title: string): string =>
    title
        .toLowerCase()
        .replaceAll(/[^\p{L}\p{N}\s_-]/gu, "")
        .trim()
        .replaceAll(/\s/gu, "-");

export function sectionKeys(sections: Section[]): string[] {
    const stack: string[] = [];
    const seen = new Map<string, number>();
    return sections.map((section) => {
        stack.length = Math.max(section.level - 1, 0);
        if (section.level > 0) {
            stack.push(slug(section.title));
        }
        const base = `/${stack.join("/")}`;
        const count = (seen.get(base) ?? 0) + 1;
        seen.set(base, count);
        return count === 1 ? base : `${base}~${count}`;
    });
}

export function structureError(
    en: [Section, ...Section[]],
    zh: [Section, ...Section[]],
): string | null {
    if (Boolean(en[0].hash) !== Boolean(zh[0].hash)) {
        return `text before the first heading exists on the ${en[0].hash === null ? "zh" : "en"} side only`;
    }
    const limit = Math.max(en.length, zh.length);
    for (let index = 1; index < limit; index += 1) {
        const left: Section | undefined = en.at(index);
        const right: Section | undefined = zh.at(index);
        if (
            left === undefined ||
            right === undefined ||
            left.level !== right.level
        ) {
            const describe = (section: Section | undefined, side: string) =>
                section === undefined
                    ? `nothing (${side})`
                    : `"${"#".repeat(section.level)} ${section.title}" (${side} line ${section.start})`;
            return `heading structure differs at heading ${index}: ${describe(left, "en")} vs ${describe(right, "zh")}`;
        }
    }
    return null;
}

export function computeEntries(enText: string, zhText: string): EntriesResult {
    const en = splitSections(enText);
    const zh = splitSections(zhText);
    const error = structureError(en, zh);
    if (error !== null) {
        return { error };
    }
    const keys = sectionKeys(en);
    const entries: Entry[] = [];
    en.forEach((section, index) => {
        const key = keys.at(index);
        const target = zh.at(index);
        if (
            section.hash !== null &&
            key !== undefined &&
            target !== undefined
        ) {
            entries.push({
                key,
                index,
                en: section.hash,
                zh: target.hash,
            });
        }
    });
    return { entries };
}
