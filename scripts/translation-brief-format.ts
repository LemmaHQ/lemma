import { readText } from "./translation-pairing.ts";
import type { Pair } from "./translation-pairing.ts";
import { splitSections } from "./translation-sections.ts";
import type { Section } from "./translation-sections.ts";

export const TERMINOLOGY = "docs/i18n/terminology.md";
export const CONTRACT = "docs/i18n/README.md#the-pairing-contract";

export type Side = "en" | "zh";

export interface Confirmed {
    sha: string;
    date: string;
    sections: Section[];
}

export function requireText(file: string): string {
    const text = readText(file);
    if (text === null) {
        throw new Error(`${file} is required to build the translation brief`);
    }
    return text;
}

export function fenced(text: string, info = "markdown"): string {
    const longest = Math.max(
        2,
        ...(text.match(/`+/gu) ?? []).map((run) => run.length),
    );
    const fence = "`".repeat(longest + 1);
    return `${fence}${info}\n${text}\n${fence}`;
}

export const sectionText = (section: Section): string =>
    section.lines.join("\n").trim();

export const sideHashes = (text: string): string[] =>
    splitSections(text)
        .map((section) => section.hash)
        .filter((hash): hash is string => Boolean(hash));

export const sameList = (
    left: readonly (string | undefined)[],
    right: readonly (string | undefined)[],
): boolean =>
    left.length === right.length &&
    left.every((value, index) => value === right[index]);

export function terminologyRows(text: string, side: Side): string {
    const rows = (readText(TERMINOLOGY) ?? "")
        .split("\n")
        .filter(
            (line) => /^\|.*\|$/u.test(line) && !/^\|[\s|:-]+\|$/u.test(line),
        );
    const [header] = rows;
    if (header === undefined) {
        return "No listed term occurs in the changed text.";
    }
    const matches = rows.filter((row) => {
        const term = (row.split("|").at(side === "en" ? 1 : 2) ?? "").trim();
        const flags = /\p{Lu}/u.test(term) ? "u" : "iu";
        const pattern = `(^|[^\\p{Script=Latin}])${RegExp.escape(term)}(?:e?s)?($|[^\\p{Script=Latin}])`;
        return (
            row !== header &&
            term !== "" &&
            new RegExp(pattern, flags).test(text)
        );
    });
    return matches.length > 0
        ? [header, header.replaceAll(/[^|]+/gu, "---"), ...matches].join("\n")
        : "No listed term occurs in the changed text.";
}

export const rules = (pair: Pair): string[] => [
    "## Rules",
    "",
    `- Structure, code blocks, links, and the language switcher follow [the pairing contract](${CONTRACT}).`,
    `- Render every listed term as [${TERMINOLOGY}](${TERMINOLOGY}) specifies.`,
    `- Then record and check the pair: \`just docs-pairing ${pair.en}\`, then \`just docs-pairing-check ${pair.en}\`.`,
];

export const wholeDocumentBrief = (
    pair: Pair,
    label: string,
    task: string,
    termsText: string,
    sourceSide: Side,
    extra: string[] = [],
): string[] => [
    `# Translation brief: ${pair.en}`,
    "",
    `**${label}.** ${task}`,
    ...extra,
    "",
    "## Terminology",
    "",
    terminologyRows(termsText, sourceSide),
    "",
    ...rules(pair),
];
