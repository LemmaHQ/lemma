import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface Pair {
    en: string;
    zh: string;
    record: string;
}

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

export interface RecordEntry {
    key: string;
    en?: string;
    zh?: string;
}

export type EntriesResult =
    | { entries: Entry[]; error?: undefined }
    | { entries?: undefined; error: string };

export const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const EXCLUDED = [
    /^\.agents\/skills\/[^/]+\//u,
    /^docs\/i18n\/terminology\.md$/u,
];
const FENCE = /^ {0,3}(`{3,}|~{3,})/u;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/u;
const RECORD_LINE = /^(\/\S*):$|^ {2}(en|zh): ([0-9a-f]{16})$/u;

export function git(args: string[]): string {
    return execFileSync("git", args, {
        cwd: ROOT_DIR,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    });
}

export const isExcluded = (file: string): boolean =>
    EXCLUDED.some((pattern) => pattern.test(file));

export function readText(file: string): string | null {
    const absolute = path.join(ROOT_DIR, file);
    return fs.existsSync(absolute)
        ? fs.readFileSync(absolute, "utf8").replaceAll("\r\n", "\n")
        : null;
}

export function pairOf(arg: string): Pair {
    const file = path
        .relative(ROOT_DIR, path.resolve(arg))
        .split(path.sep)
        .join("/");
    const stem = file.replace(/(\.zh)?\.md$|\.i18n\.yaml$/u, "");
    return {
        en: `${stem}.md`,
        zh: `${stem}.zh.md`,
        record: `${stem}.i18n.yaml`,
    };
}

export function listPairs(): Pair[] {
    const files = git([
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        "*.md",
        "*.i18n.yaml",
    ])
        .split("\0")
        .filter(
            (file) => file !== "" && fs.existsSync(path.join(ROOT_DIR, file)),
        );
    const pairs = new Map<string, Pair>();
    for (const file of files) {
        const pair = pairOf(path.join(ROOT_DIR, file));
        pairs.set(pair.en, pair);
    }
    return [...pairs.values()].toSorted((a, b) => a.en.localeCompare(b.en));
}

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

export const formatRecord = (pair: Pair, entries: Entry[]): string =>
    [
        `# Translation-pairing record for ${path.posix.basename(pair.en)} (docs/i18n/README.md): one`,
        "# entry per heading section, holding a hash of its English and Chinese text.",
        "# After bringing both sides to the same meaning, re-record with:",
        `#   just docs-pairing ${pair.en}`,
        ...entries.flatMap(({ key, en, zh }) => [
            `${key}:`,
            `  en: ${en}`,
            `  zh: ${zh}`,
        ]),
        "",
    ].join("\n");

const isSide = (value: string): value is "en" | "zh" =>
    value === "en" || value === "zh";

export function parseRecord(text: string): RecordEntry[] {
    const entries: RecordEntry[] = [];
    for (const line of text.split("\n")) {
        const match = RECORD_LINE.exec(line);
        if (match === null) continue;
        const [, key, side, hash] = match;
        if (key !== undefined) {
            entries.push({ key });
        } else if (side !== undefined && hash !== undefined && isSide(side)) {
            const last = entries.at(-1);
            if (last !== undefined) {
                last[side] = hash;
            }
        }
    }
    return entries;
}

export function checkPair(pair: Pair): string[] {
    const enText = readText(pair.en);
    const zhText = readText(pair.zh);
    const recordText = readText(pair.record);
    if (isExcluded(pair.en)) {
        return zhText !== null || recordText !== null
            ? [
                  `${pair.en} is excluded from pairing but has ${zhText === null ? pair.record : pair.zh}`,
              ]
            : [];
    }
    if (enText === null) {
        return [`${zhText === null ? pair.record : pair.zh} has no ${pair.en}`];
    }
    if (zhText === null) {
        return [`${pair.en} has no ${pair.zh}`];
    }
    const result = computeEntries(enText, zhText);
    if (result.error !== undefined) {
        return [`${pair.en}: ${result.error}`];
    }
    const { entries } = result;
    if (recordText === null) {
        return [`${pair.en} has no ${pair.record}`];
    }
    if (recordText === formatRecord(pair, entries)) {
        return [];
    }
    const recorded = new Map<string, RecordEntry>(
        parseRecord(recordText).map((entry) => [entry.key, entry]),
    );
    const current = new Set(entries.map((entry) => entry.key));
    const changes = entries.flatMap(({ key, en, zh }) => {
        const entry = recorded.get(key);
        if (entry === undefined) {
            return [`${key} (new)`];
        }
        const sides = [entry.en !== en && "en", entry.zh !== zh && "zh"].filter(
            Boolean,
        );
        return sides.length > 0
            ? [`${key} (${sides.join(" and ")} changed)`]
            : [];
    });
    const removed = [...recorded.keys()]
        .filter((key) => !current.has(key))
        .map((key) => `${key} (removed)`);
    const detail = [...changes, ...removed];
    return [
        `${pair.en} is out of sync with ${pair.record}: ${detail.length > 0 ? detail.join(", ") : "record is not canonical"}`,
    ];
}

export function writeRecord(pair: Pair): void {
    const enText = readText(pair.en);
    const zhText = readText(pair.zh);
    if (enText === null || zhText === null) {
        throw new Error(
            `${pair.en}: both ${pair.en} and ${pair.zh} must exist to record the pair`,
        );
    }
    const result = computeEntries(enText, zhText);
    if (result.error !== undefined) {
        throw new Error(`${pair.en}: ${result.error}`);
    }
    fs.writeFileSync(
        path.join(ROOT_DIR, pair.record),
        formatRecord(pair, result.entries),
    );
}
