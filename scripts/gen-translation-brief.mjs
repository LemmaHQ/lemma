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
} from "./translation-pairing.mjs";

const TERMINOLOGY = "docs/i18n/terminology.md";
const CONTRACT = "docs/i18n/README.md#the-pairing-contract";

function fenced(text, info = "markdown") {
    const longest = Math.max(
        2,
        ...(text.match(/`+/g) ?? []).map((run) => run.length),
    );
    const fence = "`".repeat(longest + 1);
    return `${fence}${info}\n${text}\n${fence}`;
}

const sectionText = (section) => section.lines.join("\n").trim();

const sideHashes = (text) =>
    splitSections(text)
        .map((section) => section.hash)
        .filter(Boolean);

const sameList = (left, right) =>
    left.length === right.length &&
    left.every((value, index) => value === right[index]);

function terminologyRows(text, side) {
    const rows = (readText(TERMINOLOGY) ?? "")
        .split("\n")
        .filter(
            (line) => /^\|.*\|$/.test(line) && !/^\|[\s|:-]+\|$/.test(line),
        );
    const [header] = rows;
    const matches = rows.filter((row) => {
        const term = row.split("|")[side === "en" ? 1 : 2].trim();
        const flags = /\p{Lu}/u.test(term) ? "u" : "iu";
        const pattern = `(^|[^\\p{Script=Latin}])${RegExp.escape(term)}(?:e?s)?($|[^\\p{Script=Latin}])`;
        return (
            row !== header &&
            term !== "" &&
            new RegExp(pattern, flags).test(text)
        );
    });
    return matches.length
        ? [header, header.replace(/[^|]+/g, "---"), ...matches].join("\n")
        : "No listed term occurs in the changed text.";
}

function confirmedRevision(file, hashes) {
    const log = git(["log", "--format=%H %cs", "--", file]).trim();
    for (const line of log ? log.split("\n") : []) {
        const [sha, date] = line.split(" ");
        const text = git(["show", `${sha}:${file}`]).replace(/\r\n/g, "\n");
        if (sameList(sideHashes(text), hashes)) {
            return { sha, date, sections: splitSections(text) };
        }
    }
    return null;
}

const rules = (pair) => [
    "## Rules",
    "",
    `- Structure, code blocks, links, and the language switcher follow [the pairing contract](${CONTRACT}).`,
    `- Render every listed term as [${TERMINOLOGY}](${TERMINOLOGY}) specifies.`,
    `- Then record and check the pair: \`just docs-pairing ${pair.en}\`, then \`just docs-pairing-check ${pair.en}\`.`,
];

const wholeDocumentBrief = (
    pair,
    label,
    task,
    termsText,
    sourceSide,
    extra = [],
) => [
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

function sectionBrief(pair, sourceSide, confirmed, entries, recorded) {
    const targetSide = sourceSide === "en" ? "zh" : "en";
    const sourceSections = splitSections(readText(pair[sourceSide]));
    const targetSections = splitSections(readText(pair[targetSide]));
    const keys = sectionKeys(splitSections(readText(pair.en)));
    const changed = entries.filter(
        (entry, index) => entry[sourceSide] !== recorded[index][sourceSide],
    );
    const lines = [
        `# Translation brief: ${pair.en}`,
        "",
        `**Update.** Source: \`${pair[sourceSide]}\`. Target: \`${pair[targetSide]}\`. Change only what the source change covers and keep the target's reviewed wording elsewhere.`,
        confirmed
            ? `Last confirmed source: commit ${confirmed.sha.slice(0, 7)} (${confirmed.date}).`
            : "No commit of the source matches the record, so the confirmed source text is not shown.",
        "",
        "## Changed sections",
    ];
    for (const { index } of changed) {
        const source = sourceSections[index];
        const target = targetSections[index];
        lines.push("", `### ${keys[index]}`, "");
        if (confirmed) {
            lines.push(
                `Confirmed source (${confirmed.sha.slice(0, 7)}):`,
                "",
                fenced(sectionText(confirmed.sections[index])),
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
    }
    const changedText = changed
        .map(({ index }) => sectionText(sourceSections[index]))
        .join("\n");
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

function updateBrief(pair) {
    const recorded = parseRecord(readText(pair.record));
    const changedSides = ["en", "zh"].filter(
        (side) =>
            !sameList(
                sideHashes(readText(pair[side])),
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
            readText(pair.en),
            "en",
        );
    }
    const [sourceSide] = changedSides;
    const confirmed = confirmedRevision(
        pair[sourceSide],
        recorded.map((entry) => entry[sourceSide]),
    );
    const { entries, error } = computeEntries(
        readText(pair.en),
        readText(pair.zh),
    );
    if (!error && entries.length === recorded.length) {
        return sectionBrief(pair, sourceSide, confirmed, entries, recorded);
    }
    const diff = confirmed
        ? git(["diff", confirmed.sha, "--", pair[sourceSide]]).trim()
        : "";
    const added = diff
        .split("\n")
        .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
        .join("\n");
    return wholeDocumentBrief(
        pair,
        "Sections added or removed",
        `\`${pair[sourceSide]}\` changed its headings. Mirror the change in \`${pair[sourceSide === "en" ? "zh" : "en"]}\`: add, remove, or move the same sections and translate the new text.`,
        diff ? added : readText(pair[sourceSide]),
        sourceSide,
        diff
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

function brief(pair) {
    if (readText(pair.zh) === null) {
        return wholeDocumentBrief(
            pair,
            "New pair",
            `Write \`${pair.zh}\` from \`${pair.en}\`.`,
            readText(pair.en),
            "en",
        );
    }
    if (readText(pair.en) === null) {
        return wholeDocumentBrief(
            pair,
            "New pair",
            `Write \`${pair.en}\` from \`${pair.zh}\`.`,
            readText(pair.zh),
            "zh",
        );
    }
    if (readText(pair.record) === null) {
        return wholeDocumentBrief(
            pair,
            "Unrecorded pair",
            `Compare \`${pair.en}\` and \`${pair.zh}\` in full and align them before the first record.`,
            readText(pair.en),
            "en",
        );
    }
    return updateBrief(pair);
}

const files = process.argv.slice(2);
const pending = (files.length ? files.map(pairOf) : listPairs()).filter(
    (pair) => !isExcluded(pair.en) && checkPair(pair).length > 0,
);
console.log(
    pending.map((pair) => brief(pair).join("\n")).join("\n\n") ||
        "All pairs are in sync.",
);
