import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { ROOT_DIR } from "./translation-pairing.ts";
import type { Pair } from "./translation-pairing.ts";
import { checkPair, writeRecord } from "./translation-records.ts";

interface PairFixture {
    pair: Pair;
    paths: Pair;
}

void test("reports an excluded pair that has a Chinese file", (context) => {
    const { pair, paths } = pairFixture(context, true);
    fs.writeFileSync(paths.zh, "# 标题\n");
    assert.deepEqual(checkPair(pair), [
        `${pair.en} is excluded from pairing but has ${pair.zh}`,
    ]);
});

void test("reports a missing English file", (context) => {
    const { pair, paths } = pairFixture(context);
    fs.writeFileSync(paths.zh, "# 标题\n");
    assert.deepEqual(checkPair(pair), [`${pair.zh} has no ${pair.en}`]);
});

void test("reports a missing Chinese file", (context) => {
    const { pair, paths } = pairFixture(context);
    fs.writeFileSync(paths.en, "# Title\n");
    assert.deepEqual(checkPair(pair), [`${pair.en} has no ${pair.zh}`]);
});

void test("reports a missing pairing record", (context) => {
    const { pair, paths } = pairFixture(context);
    fs.writeFileSync(paths.en, "# Title\n\nText\n");
    fs.writeFileSync(paths.zh, "# 标题\n\n正文\n");
    assert.deepEqual(checkPair(pair), [`${pair.en} has no ${pair.record}`]);
});

void test("details new, changed, and removed record entries", (context) => {
    const { pair, paths } = pairFixture(context);
    fs.writeFileSync(paths.en, "# Alpha\n\nOld\n\n# Removed\n\nGone\n");
    fs.writeFileSync(paths.zh, "# Alpha\n\n旧\n\n# Removed\n\n已删\n");
    writeRecord(pair);
    fs.writeFileSync(paths.en, "# Alpha\n\nNew\n\n# Beta\n\nAdded\n");
    fs.writeFileSync(paths.zh, "# Alpha\n\n新\n\n# Beta\n\n新增\n");
    assert.deepEqual(checkPair(pair), [
        `${pair.en} is out of sync with ${pair.record}: /alpha (en and zh changed), /beta (new), /removed (removed)`,
    ]);
});

void test("reports a noncanonical record with no entry differences", (context) => {
    const { pair, paths } = pairFixture(context);
    fs.writeFileSync(paths.en, "# Title\n\nText\n");
    fs.writeFileSync(paths.zh, "# 标题\n\n正文\n");
    writeRecord(pair);
    fs.appendFileSync(paths.record, "# Not canonical\n");
    assert.deepEqual(checkPair(pair), [
        `${pair.en} is out of sync with ${pair.record}: record is not canonical`,
    ]);
});

function pairFixture(context: TestContext, excluded = false): PairFixture {
    const parent = excluded
        ? path.join(ROOT_DIR, ".agents", "skills")
        : ROOT_DIR;
    const directory = fs.mkdtempSync(
        path.join(parent, ".translation-records-"),
    );
    context.after(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const paths = {
        en: path.join(directory, "guide.md"),
        zh: path.join(directory, "guide.zh.md"),
        record: path.join(directory, "guide.i18n.yaml"),
    };
    return {
        pair: {
            en: relativePath(paths.en),
            zh: relativePath(paths.zh),
            record: relativePath(paths.record),
        },
        paths,
    };
}

function relativePath(file: string): string {
    return path.relative(ROOT_DIR, file).split(path.sep).join("/");
}
