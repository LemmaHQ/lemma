import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR, git, readText } from "./translation-pairing.mjs";

const EXCLUDED = /^\.agents\/skills\/lemma-code-style\/references\//;
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w-]*)/;
const SHELL_FENCES = new Set(["sh", "bash", "shell", "console"]);
const CODE_SPAN = /(`+)(?!`)(.+?)(?<!`)\1(?!`)/g;
const RECIPE_CALL = /(?<![\w-])just\s+([a-z][a-z0-9-]*)/g;
const RECIPE_SPAN = /^just\s+([a-z][a-z0-9-]*)/;
const PLACEHOLDER = /[<>*{}$…]|\.\.\./;

const recipes = new Set(
    execFileSync("just", ["--summary"], { cwd: ROOT_DIR, encoding: "utf8" })
        .trim()
        .split(/\s+/),
);

const tracked = git([
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
])
    .split("\0")
    .filter((file) => file && fs.existsSync(path.join(ROOT_DIR, file)));
const existing = new Set();
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

function repoPath(span) {
    if (/\s/.test(span) || PLACEHOLDER.test(span)) return null;
    const target = span.replace(/[#:].*$/, "").replace(/\/$/, "");
    const [first] = target.split("/");
    return target.includes("/") && topLevelDirs.has(first) ? target : null;
}

function ignoredPaths(paths) {
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
        if (error.status !== 1) throw error;
    }
    return new Set(
        output
            .split("\n")
            .filter(Boolean)
            .map((p) => p.replace(/\/$/, "")),
    );
}

const files = tracked
    .filter((file) => file.endsWith(".md") && !EXCLUDED.test(file))
    .sort();
const problems = [];
const pathRefs = [];

function checkRecipe(where, name) {
    if (!recipes.has(name))
        problems.push(`${where}: unknown recipe \`just ${name}\``);
}

for (const file of files) {
    const lines = readText(file).split("\n");
    let fence = null;
    lines.forEach((line, index) => {
        const where = `${file}:${index + 1}`;
        const fenceMatch = line.match(FENCE);
        if (fence) {
            if (fenceMatch && line.trim().startsWith(fence.marker)) {
                fence = null;
            } else if (fence.shell) {
                const command = line.replace(/(^|\s)#.*$/, "");
                for (const [, name] of command.matchAll(RECIPE_CALL))
                    checkRecipe(where, name);
            }
            return;
        }
        if (fenceMatch) {
            fence = {
                marker: fenceMatch[1],
                shell: SHELL_FENCES.has(fenceMatch[2]),
            };
            return;
        }
        for (const [, , raw] of line.matchAll(CODE_SPAN)) {
            const span = raw.trim();
            const call = span.match(RECIPE_SPAN);
            if (call) checkRecipe(where, call[1]);
            const target = repoPath(span);
            if (target && !existing.has(target))
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
process.exit(problems.length ? 1 : 0);
