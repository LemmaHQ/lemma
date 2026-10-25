import { git } from "./translation-pairing.ts";
import type { Pair } from "./translation-pairing.ts";
import { sectionKeys, splitSections } from "./translation-sections.ts";
import type { Entry } from "./translation-sections.ts";
import type { RecordEntry } from "./translation-records.ts";
import {
    fenced,
    requireText,
    rules,
    sameList,
    sectionText,
    sideHashes,
    terminologyRows,
} from "./translation-brief-format.ts";
import type { Confirmed, Side } from "./translation-brief-format.ts";

export function confirmedRevision(
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

export function sectionBrief(
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
