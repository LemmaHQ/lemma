import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface Pair {
    en: string;
    zh: string;
    record: string;
}

export const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const EXCLUDED = [
    /^\.agents\/skills\/[^/]+\//u,
    /^docs\/i18n\/terminology\.md$/u,
];

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
