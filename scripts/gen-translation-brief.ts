import {
    git,
    isExcluded,
    listPairs,
    pairOf,
    readText,
} from "./translation-pairing.ts";
import type { Pair } from "./translation-pairing.ts";
import { checkPair, parseRecord } from "./translation-records.ts";
import { computeEntries } from "./translation-sections.ts";
import {
    fenced,
    requireText,
    sameList,
    sideHashes,
    wholeDocumentBrief,
} from "./translation-brief-format.ts";
import {
    confirmedRevision,
    sectionBrief,
} from "./translation-brief-sections.ts";

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
