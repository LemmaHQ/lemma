import fs from "node:fs";
import path from "node:path";
import { reportProblems } from "./report-problems.ts";
import { checkSourceFile, matches } from "./source-file-rules.ts";
import { ROOT_DIR, git } from "./translation-pairing.ts";

const SOURCE = /\.(?:rs|py|proto|kt|kts|[cm]?[jt]s|[jt]sx)$/u;
const UNCHECKED = [
    /^\.agents\//u,
    /^packages\/ui\/src\/(?:components|hooks)\//u,
];
const TEST = [
    /(?:^|\/)tests\//u,
    /\.test\.[cm]?[jt]sx?$/u,
    /\/src\/(?:test|\w+Test)\//u,
];

const files = git([
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
])
    .split("\0")
    .filter(
        (file) =>
            SOURCE.test(file) &&
            !matches(UNCHECKED, file) &&
            fs.existsSync(path.join(ROOT_DIR, file)),
    )
    .toSorted();
const packageEntries = new Set(
    git(["ls-files", "package.json", "*/package.json"])
        .split("\n")
        .filter((file) => file !== "")
        .flatMap((file) => entriesOf(file)),
);
const problems: string[] = [];

for (const file of files) {
    const text = fs
        .readFileSync(path.join(ROOT_DIR, file), "utf8")
        .replaceAll("\r\n", "\n");
    const isTest = matches(TEST, file);
    checkSourceFile(file, text, isTest, packageEntries, problems);
}

reportProblems(problems, `${files.length} files`);

function entriesOf(manifest: string): string[] {
    const parsed: unknown = JSON.parse(
        fs.readFileSync(path.join(ROOT_DIR, manifest), "utf8"),
    );
    if (typeof parsed !== "object" || parsed === null) {
        return [];
    }
    const { main, exports } = parsed as { main?: unknown; exports?: unknown };
    const dir = path.posix.dirname(manifest);
    return [main, exports]
        .flatMap((value) => targetsOf(value))
        .map((target) => path.posix.join(dir, target));
}

function targetsOf(value: unknown): string[] {
    if (typeof value === "string") {
        return [value];
    }
    if (typeof value === "object" && value !== null) {
        return Object.values(value).flatMap((nested) => targetsOf(nested));
    }
    return [];
}
