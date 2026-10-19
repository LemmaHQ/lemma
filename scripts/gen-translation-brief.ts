import {
    checkPair,
    computeEntries,
    git,
    isExcluded,
    listPairs,
    pairOf,
    parseRecord,
    readText,
    sectionKeys,
    splitSections,
} from "./translation-pairing.ts";
import type {
    Entry,
    Pair,
    RecordEntry,
    Section,
} from "./translation-pairing.ts";

const TERMINOLOGY = "docs/i18n/terminology.md";
const CONTRACT = "docs/i18n/README.md#the-pairing-contract";

type Side = "en" | "zh";

function requireText(file: string): string {
    const text = readText(file);
    if (text === null) {
        throw new Error(`${file} is required to build the translation brief`);
    }
    return text;
}

interface Confirmed {
    sha: string;
    date: string;
    sections: Section[];
}

function fenced(text: string, info = "markdown"): string {
    const longest = Math.max(
        2,
        ...(text.match(/`+/gu) ?? []).map((run) => run.length),
    );
    const fence = "`".repeat(longest + 1);
    return `${fence}${info}\n${text}\n${fence}`;
}

const sectionText = (section: Section): string =>
    section.lines.join("\n").trim();

const sideHashes = (text: string): string[] =>
    splitSections(text)
        .map((section) => section.hash)
        .filter((hash): hash is string => Boolean(hash));

const sameList = (
    left: readonly (string | undefined)[],
    right: readonly (string | undefined)[],
): boolean =>
    left.length === right.length &&
    left.every((value, index) => value === right[index]);

function terminologyRows(text: string, side: Side): string {
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

function confirmedRevision(
    file: string,
    hashes: (string | undefined)[],
): Confirmed | null {
    const log = git(["log", "--format=%H %cs", "--", file]).trim();
    for (const line of log === "" ? [] : log.split("\n")) {
        const [sha, date] = line.split(" ");
        if (sha === undefined || date === undefined) continue;
        const text = git(["show", `${sha}:${file}`]).replaceAll("\r\n", "\n");
        if (sameList(sideHashes(text), hashes)) {
            return { sha, date, sections: splitSections(text) };
        }
    }
    return null;
}

const rules = (pair: Pair): string[] => [
    "## Rules",
    "",
    `- Structure, code blocks, links, and the language switcher follow [the pairing contract](${CONTRACT}).`,
    `- Render every listed term as [${TERMINOLOGY}](${TERMINOLOGY}) specifies.`,
    `- Then record and check the pair: \`just docs-pairing ${pair.en}\`, then \`just docs-pairing-check ${pair.en}\`.`,
];

const wholeDocumentBrief = (
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

function sectionBrief(
    pair: Pair,
    sourceSide: Side,
    confirmed: Confirmed | null,
    entries: Entry[],
    recorded: RecordEntry[],
): string[] {
    const targetSide: Side = sourceSide === "en" ? "zh" : "en";
    const sourceSections = splitSections(requireText(pair[sourceSide]));
    const targetSections = splitSections(requireText(pair[targetSide]));
    const keys = sectionKeys(splitSections(requireText(pair.en)));
    const changed = entries.filter(
        (entry, index) =>
            entry[sourceSide] !== recorded.at(index)?.[sourceSide],
    );
    const lines = [
        `# Translation brief: ${pair.en}`,
        "",
        `**Update.** Source: \`${pair[sourceSide]}\`. Target: \`${pair[targetSide]}\`. Change only what the source change covers and keep the target's reviewed wording elsewhere.`,
        confirmed === null
            ? "No commit of the source matches the record, so the confirmed source text is not shown."
            : `Last confirmed source: commit ${confirmed.sha.slice(0, 7)} (${confirmed.date}).`,
        "",
        "## Changed sections",
    ];
    const changedTexts: string[] = [];
    for (const { index } of changed) {
        const source = sourceSections.at(index);
        const target = targetSections.at(index);
        if (source === undefined || target === undefined) {
            throw new Error(
                `${pair.en}: section ${index} is missing on one side`,
            );
        }
        lines.push("", `### ${keys.at(index) ?? ""}`, "");
        if (confirmed !== null) {
            const confirmedSection = confirmed.sections.at(index);
            if (confirmedSection === undefined) {
                throw new Error(
                    `${pair.en}: confirmed source has no section ${index}`,
                );
            }
            lines.push(
                `Confirmed source (${confirmed.sha.slice(0, 7)}):`,
                "",
                fenced(sectionText(confirmedSection)),
                "",
            );
        }
        lines.push(
            `Current source (\`${pair[sourceSide]}:${source.start}-${source.end}\`):`,
            "",
            fenced(sectionText(source)),
            "",
            `Current target (\`${pair[targetSide]}:${target.start}-${target.end}\`):`,
            "",
            fenced(sectionText(target)),
        );
        changedTexts.push(sectionText(source));
    }
    const changedText = changedTexts.join("\n");
    lines.push(
        "",
        "## Terminology",
        "",
        terminologyRows(changedText, sourceSide),
        "",
        ...rules(pair),
    );
    return lines;
}

function updateBrief(pair: Pair): string[] {
    const recorded = parseRecord(requireText(pair.record));
    const changedSides = (["en", "zh"] as const).filter(
        (side) =>
            !sameList(
                sideHashes(requireText(pair[side])),
                recorded.map((entry) => entry[side]),
            ),
    );
    if (changedSides.length === 0) {
        return [
            `# Translation brief: ${pair.en}`,
            "",
            `**Record only.** Both sides match their recorded hashes; rewrite the record with \`just docs-pairing ${pair.en}\`.`,
        ];
    }
    if (changedSides.length === 2) {
        return wholeDocumentBrief(
            pair,
            "Both sides changed",
            `Reconcile \`${pair.en}\` and \`${pair.zh}\` by hand: carry each side's change to the other and keep the reviewed wording that neither change touched. \`git diff\` on both files shows the uncommitted part of each change.`,
            requireText(pair.en),
            "en",
        );
    }
    const [sourceSide] = changedSides;
    if (sourceSide === undefined) {
        throw new Error(`${pair.en}: could not determine which side changed`);
    }
    const confirmed = confirmedRevision(
        pair[sourceSide],
        recorded.map((entry) => entry[sourceSide]),
    );
    const result = computeEntries(requireText(pair.en), requireText(pair.zh));
    if (
        result.error === undefined &&
        result.entries.length === recorded.length
    ) {
        return sectionBrief(
            pair,
            sourceSide,
            confirmed,
            result.entries,
            recorded,
        );
    }
    const diff =
        confirmed === null
            ? ""
            : git(["diff", confirmed.sha, "--", pair[sourceSide]]).trim();
    const added = diff
        .split("\n")
        .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
        .join("\n");
    return wholeDocumentBrief(
        pair,
        "Sections added or removed",
        `\`${pair[sourceSide]}\` changed its headings. Mirror the change in \`${pair[sourceSide === "en" ? "zh" : "en"]}\`: add, remove, or move the same sections and translate the new text.`,
        diff === "" ? requireText(pair[sourceSide]) : added,
        sourceSide,
        diff !== "" && confirmed !== null
            ? [
                  "",
                  `Source change since commit ${confirmed.sha.slice(0, 7)} (${confirmed.date}):`,
                  "",
                  fenced(diff, "diff"),
              ]
            : [
                  "",
                  "No commit of the source matches the record; compare both files in full.",
              ],
    );
}

function brief(pair: Pair): string[] {
    if (readText(pair.zh) === null) {
        return wholeDocumentBrief(
            pair,
            "New pair",
            `Write \`${pair.zh}\` from \`${pair.en}\`.`,
            requireText(pair.en),
            "en",
        );
    }
    if (readText(pair.en) === null) {
        return wholeDocumentBrief(
            pair,
            "New pair",
            `Write \`${pair.en}\` from \`${pair.zh}\`.`,
            requireText(pair.zh),
            "zh",
        );
    }
    if (readText(pair.record) === null) {
        return wholeDocumentBrief(
            pair,
            "Unrecorded pair",
            `Compare \`${pair.en}\` and \`${pair.zh}\` in full and align them before the first record.`,
            requireText(pair.en),
            "en",
        );
    }
    return updateBrief(pair);
}

const files = process.argv.slice(2);
const pending = (files.length > 0 ? files.map(pairOf) : listPairs()).filter(
    (pair) => !isExcluded(pair.en) && checkPair(pair).length > 0,
);
const output = pending.map((pair) => brief(pair).join("\n")).join("\n\n");
console.log(output === "" ? "All pairs are in sync." : output);
