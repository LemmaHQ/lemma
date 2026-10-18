import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const EXCLUDED = [
    /^\.agents\/skills\/[^/]+\//,
    /^docs\/i18n\/terminology\.md$/,
];
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const RECORD_LINE = /^(\/\S*):$|^ {2}(en|zh): ([0-9a-f]{16})$/;

export function git(args) {
    return execFileSync("git", args, {
        cwd: ROOT_DIR,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    });
}

export const isExcluded = (file) =>
    EXCLUDED.some((pattern) => pattern.test(file));

export function readText(file) {
    const absolute = path.join(ROOT_DIR, file);
    return fs.existsSync(absolute)
        ? fs.readFileSync(absolute, "utf8").replace(/\r\n/g, "\n")
        : null;
}

export function pairOf(arg) {
    const file = path
        .relative(ROOT_DIR, path.resolve(arg))
        .split(path.sep)
        .join("/");
    const stem = file.replace(/(\.zh)?\.md$|\.i18n\.yaml$/, "");
    return {
        en: `${stem}.md`,
        zh: `${stem}.zh.md`,
        record: `${stem}.i18n.yaml`,
    };
}

export function listPairs() {
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
        .filter((file) => file && fs.existsSync(path.join(ROOT_DIR, file)));
    const pairs = new Map();
    for (const file of files) {
        const pair = pairOf(path.join(ROOT_DIR, file));
        pairs.set(pair.en, pair);
    }
    return [...pairs.values()].sort((a, b) => a.en.localeCompare(b.en));
}

export function splitSections(text) {
    const sections = [{ level: 0, title: "", start: 1, lines: [] }];
    let fence = null;
    text.split("\n").forEach((line, index) => {
        const fenceMatch = FENCE.exec(line);
        if (fence) {
            if (
                fenceMatch &&
                fenceMatch[1][0] === fence[0] &&
                fenceMatch[1].length >= fence.length
            ) {
                fence = null;
            }
        } else if (fenceMatch) {
            fence = fenceMatch[1];
        } else {
            const heading = HEADING.exec(line);
            if (heading) {
                sections.push({
                    level: heading[1].length,
                    title: heading[2],
                    start: index + 1,
                    lines: [],
                });
            }
        }
        sections.at(-1).lines.push(line);
    });
    for (const section of sections) {
        const body = section.lines
            .map((line) => line.trimEnd())
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        section.end = section.start + section.lines.length - 1;
        section.hash = body
            ? createHash("sha256").update(body).digest("hex").slice(0, 16)
            : null;
    }
    return sections;
}

const slug = (title) =>
    title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .trim()
        .replace(/\s/g, "-");

export function sectionKeys(sections) {
    const stack = [];
    const seen = new Map();
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

export function structureError(en, zh) {
    if (Boolean(en[0].hash) !== Boolean(zh[0].hash)) {
        return `text before the first heading exists on the ${en[0].hash ? "en" : "zh"} side only`;
    }
    const limit = Math.max(en.length, zh.length);
    for (let index = 1; index < limit; index += 1) {
        const left = en[index];
        const right = zh[index];
        if (!left || !right || left.level !== right.level) {
            const describe = (section, side) =>
                section
                    ? `"${"#".repeat(section.level)} ${section.title}" (${side} line ${section.start})`
                    : `nothing (${side})`;
            return `heading structure differs at heading ${index}: ${describe(left, "en")} vs ${describe(right, "zh")}`;
        }
    }
    return null;
}

export function computeEntries(enText, zhText) {
    const en = splitSections(enText);
    const zh = splitSections(zhText);
    const error = structureError(en, zh);
    if (error) {
        return { error };
    }
    const keys = sectionKeys(en);
    const entries = [];
    en.forEach((section, index) => {
        if (section.hash) {
            entries.push({
                key: keys[index],
                index,
                en: section.hash,
                zh: zh[index].hash,
            });
        }
    });
    return { entries };
}

export const formatRecord = (pair, entries) =>
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

export function parseRecord(text) {
    const entries = [];
    for (const line of text.split("\n")) {
        const match = RECORD_LINE.exec(line);
        if (match?.[1]) {
            entries.push({ key: match[1] });
        } else if (match && entries.length) {
            entries.at(-1)[match[2]] = match[3];
        }
    }
    return entries;
}

export function checkPair(pair) {
    const enText = readText(pair.en);
    const zhText = readText(pair.zh);
    const recordText = readText(pair.record);
    if (isExcluded(pair.en)) {
        return zhText !== null || recordText !== null
            ? [
                  `${pair.en} is excluded from pairing but has ${zhText !== null ? pair.zh : pair.record}`,
              ]
            : [];
    }
    if (enText === null) {
        return [`${zhText !== null ? pair.zh : pair.record} has no ${pair.en}`];
    }
    if (zhText === null) {
        return [`${pair.en} has no ${pair.zh}`];
    }
    const { entries, error } = computeEntries(enText, zhText);
    if (error) {
        return [`${pair.en}: ${error}`];
    }
    if (recordText === null) {
        return [`${pair.en} has no ${pair.record}`];
    }
    if (recordText === formatRecord(pair, entries)) {
        return [];
    }
    const recorded = new Map(
        parseRecord(recordText).map((entry) => [entry.key, entry]),
    );
    const current = new Set(entries.map((entry) => entry.key));
    const changes = entries.flatMap(({ key, en, zh }) => {
        const entry = recorded.get(key);
        if (!entry) {
            return [`${key} (new)`];
        }
        const sides = [entry.en !== en && "en", entry.zh !== zh && "zh"].filter(
            Boolean,
        );
        return sides.length ? [`${key} (${sides.join(" and ")} changed)`] : [];
    });
    const removed = [...recorded.keys()]
        .filter((key) => !current.has(key))
        .map((key) => `${key} (removed)`);
    const detail = [...changes, ...removed];
    return [
        `${pair.en} is out of sync with ${pair.record}: ${detail.length ? detail.join(", ") : "record is not canonical"}`,
    ];
}

export function writeRecord(pair) {
    const enText = readText(pair.en);
    const zhText = readText(pair.zh);
    if (enText === null || zhText === null) {
        throw new Error(
            `${pair.en}: both ${pair.en} and ${pair.zh} must exist to record the pair`,
        );
    }
    const { entries, error } = computeEntries(enText, zhText);
    if (error) {
        throw new Error(`${pair.en}: ${error}`);
    }
    fs.writeFileSync(
        path.join(ROOT_DIR, pair.record),
        formatRecord(pair, entries),
    );
}
