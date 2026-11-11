import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR, readText } from "../shared/repository.ts";
import { isExcluded } from "./translation-pairing.ts";
import type { Pair } from "./translation-pairing.ts";
import { computeEntries } from "./translation-sections.ts";
import type { Entry } from "./translation-sections.ts";

export interface RecordEntry {
  key: string;
  en?: string;
  zh?: string;
}

const RECORD_LINE = /^(\/\S*):$|^ {2}(en|zh): ([0-9a-f]{16})$/u;

const formatRecord = (pair: Pair, entries: Entry[]): string =>
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
  return recordProblems(pair, entries, recordText);
}

function recordProblems(
  pair: Pair,
  entries: Entry[],
  recordText: string,
): string[] {
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
    const values = { en, zh };
    const changed = (["en", "zh"] as const).filter(
      (side) => entry[side] !== values[side],
    );
    return changed.length > 0
      ? [`${key} (${changed.join(" and ")} changed)`]
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
