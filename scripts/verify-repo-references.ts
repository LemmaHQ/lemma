import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR, git, readText } from "./translation-pairing.ts";

const EXCLUDED = /^\.agents\/skills\/lemma-code-style\/references\//u;
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w-]*)/u;
const SHELL_FENCES = new Set(["sh", "bash", "shell", "console"]);
const CODE_SPAN = /(`+)(?!`)(.+?)(?<!`)\1(?!`)/gu;
const RECIPE_CALL = /(?<![\w-])just\s+([a-z][a-z0-9-]*)/gu;
const RECIPE_SPAN = /^just\s+([a-z][a-z0-9-]*)/u;
const PLACEHOLDER = /[<>*{}$…]|\.\.\./u;

const recipes = new Set(
    execFileSync("just", ["--summary"], { cwd: ROOT_DIR, encoding: "utf8" })
        .trim()
        .split(/\s+/u),
);

const tracked = git([
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
])
    .split("\0")
    .filter((file) => file !== "" && fs.existsSync(path.join(ROOT_DIR, file)));
const existing = new Set<string>();
for (const file of tracked) {
    const parts = file.split("/");
    for (let end = 1; end <= parts.length; end++) {
        existing.add(parts.slice(0, end).join("/"));
    }
}
const topLevelDirs = new Set(
    tracked
        .filter((file) => file.includes("/"))
        .map((file) => file.split("/")[0]),
);

function repoPath(span: string): string | null {
    if (/\s/u.test(span) || PLACEHOLDER.test(span)) return null;
    const target = span.replace(/[#:].*$/u, "").replace(/\/$/u, "");
    const [first] = target.split("/");
    return target.includes("/") && topLevelDirs.has(first) ? target : null;
}

function ignoredPaths(paths: string[]): Set<string> {
    if (paths.length === 0) return new Set();
    const candidates = paths.flatMap((p) => [p, `${p}/`]);
    let output = "";
    try {
        output = execFileSync(
            "git",
            ["check-ignore", "--no-index", "--stdin"],
            {
                cwd: ROOT_DIR,
                encoding: "utf8",
                input: candidates.join("\n"),
            },
        );
    } catch (error) {
        const status =
            typeof error === "object" && error !== null && "status" in error
                ? error.status
                : undefined;
        if (status !== 1) throw error;
    }
    return new Set(
        output
            .split("\n")
            .filter(Boolean)
            .map((p) => p.replace(/\/$/u, "")),
    );
}

const files = tracked
    .filter((file) => file.endsWith(".md") && !EXCLUDED.test(file))
    .toSorted();
const problems: string[] = [];
const pathRefs: { where: string; target: string }[] = [];

function checkRecipe(where: string, name: string): void {
    if (!recipes.has(name))
        problems.push(`${where}: unknown recipe \`just ${name}\``);
}

interface Fence {
    marker: string;
    shell: boolean;
}

for (const file of files) {
    const text = readText(file);
    if (text === null) continue;
    const lines = text.split("\n");
    let fence: Fence | null = null;
    lines.forEach((line, index) => {
        const where = `${file}:${index + 1}`;
        const fenceMatch = line.match(FENCE);
        if (fence !== null) {
            if (fenceMatch !== null && line.trim().startsWith(fence.marker)) {
                fence = null;
            } else if (fence.shell) {
                const command = line.replace(/(^|\s)#.*$/u, "");
                for (const [, name] of command.matchAll(RECIPE_CALL)) {
                    if (name !== undefined) checkRecipe(where, name);
                }
            }
            return;
        }
        if (fenceMatch !== null) {
            const marker = fenceMatch[1];
            const info = fenceMatch[2];
            if (marker !== undefined && info !== undefined) {
                fence = {
                    marker,
                    shell: SHELL_FENCES.has(info),
                };
                return;
            }
        }
        for (const [, , raw] of line.matchAll(CODE_SPAN)) {
            if (raw === undefined) continue;
            const span = raw.trim();
            const recipe = span.match(RECIPE_SPAN)?.[1];
            if (recipe !== undefined) checkRecipe(where, recipe);
            const target = repoPath(span);
            if (target !== null && !existing.has(target))
                pathRefs.push({ where, target });
        }
    });
}

const ignored = ignoredPaths([...new Set(pathRefs.map((ref) => ref.target))]);
for (const { where, target } of pathRefs) {
    if (!ignored.has(target))
        problems.push(`${where}: missing path \`${target}\``);
}

problems.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
for (const problem of problems) {
    console.error(problem);
}
console.log(`${files.length} files checked, ${problems.length} problems`);
process.exit(problems.length > 0 ? 1 : 0);
