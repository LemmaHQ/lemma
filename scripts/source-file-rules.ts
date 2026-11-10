import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR } from "./translation-pairing.ts";

const MAX_LINES = 300;
const SCRIPT = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const BUILD_CONFIG = [
    /\.gradle\.kts$/u,
    /(?:^|\/)[^/]+\.config\.[cm]?[jt]s$/u,
    /(?:^|\/)build\.rs$/u,
];
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/u;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/u;
const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const HOOK = /^use[A-Z][A-Za-z0-9]*$/u;
const FEATURE_ENTRY = /^web\/src\/features\/[^/]+\/index\.ts$/u;
const COMMENT = /\/\*[\s\S]*?\*\/|\/\/.*$/gmu;
const RE_EXPORT =
    /export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+["'][^"']+["']\s*;?/gu;
const RUST_TEST_MODULE = /^#\[cfg\(test\)\]\nmod tests \{\n/mu;

export function checkSourceFile(
    file: string,
    text: string,
    isTest: boolean,
    packageEntries: ReadonlySet<string>,
    problems: string[],
): void {
    checkLength(file, text, isTest, problems);
    checkName(file, text, isTest, problems);
    if (SCRIPT.test(file)) {
        if (isTest) {
            checkTestPlacement(file, problems);
        } else {
            checkReExport(file, text, packageEntries, problems);
        }
    } else if (file.endsWith("Test.kt") && !isTest) {
        problems.push(`${file}: a Kotlin test belongs in a test source set`);
    } else if (file.endsWith(".rs")) {
        checkRustTests(file, text, problems);
    }
}

export function matches(patterns: readonly RegExp[], value: string): boolean {
    return patterns.some((pattern) => pattern.test(value));
}

function checkLength(
    file: string,
    text: string,
    isTest: boolean,
    problems: string[],
): void {
    if (isTest || matches(BUILD_CONFIG, file)) {
        return;
    }
    const lines = text.endsWith("\n")
        ? text.split("\n").length - 1
        : text.split("\n").length;
    if (lines > MAX_LINES) {
        problems.push(
            `${file}: ${lines} lines, over the ${MAX_LINES}-line limit`,
        );
    }
}

function checkName(
    file: string,
    text: string,
    isTest: boolean,
    problems: string[],
): void {
    const base = path.posix.basename(file);
    const stem = base.split(".")[0] ?? base;
    if (/\.(?:rs|py|proto)$/u.test(file)) {
        const binary =
            /\/src\/bin\/[^/]+\.rs$/u.test(file) && KEBAB_CASE.test(stem);
        if (!SNAKE_CASE.test(stem) && !binary) {
            problems.push(`${file}: file name must be snake_case`);
        }
    } else if (file.endsWith(".kt")) {
        if (!PASCAL_CASE.test(stem)) {
            problems.push(`${file}: file name must be PascalCase`);
        }
    } else if (SCRIPT.test(file)) {
        checkScriptName(file, stem, text, isTest, problems);
    }
}

function checkScriptName(
    file: string,
    stem: string,
    text: string,
    isTest: boolean,
    problems: string[],
): void {
    if (PASCAL_CASE.test(stem)) {
        if (!file.endsWith("x")) {
            problems.push(
                `${file}: a PascalCase name is reserved for component files (.tsx)`,
            );
        } else if (!isTest && !exportsName(text, stem)) {
            problems.push(
                `${file}: a component file must export a component named ${stem}`,
            );
        }
    } else if (stem.startsWith("use-")) {
        problems.push(
            `${file}: a hook file is named after its hook in camelCase (useThing.ts)`,
        );
    } else if (!KEBAB_CASE.test(stem) && !HOOK.test(stem)) {
        problems.push(
            `${file}: file name must be kebab-case, useThing for a hook, or PascalCase for a component`,
        );
    }
}

function exportsName(text: string, name: string): boolean {
    const declaration = new RegExp(
        String.raw`export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s+${name}\b`,
        "u",
    );
    const list = new RegExp(
        String.raw`export\s*\{[^}]*\b${name}\b[^}]*\}`,
        "u",
    );
    return declaration.test(text) || list.test(text);
}

function checkTestPlacement(file: string, problems: string[]): void {
    const dir = path.posix.dirname(file);
    const subject = path.posix
        .basename(file)
        .replace(/\.test\.[cm]?[jt]sx?$/u, "");
    const candidates = ["ts", "tsx", "mts", "js", "mjs"].map(
        (ext) => `${subject}.${ext}`,
    );
    const hasSubject = [...candidates, subject].some((name) =>
        fs.existsSync(path.join(ROOT_DIR, dir, name)),
    );
    if (!hasSubject) {
        problems.push(
            `${file}: a test sits beside the module it tests (${subject}.ts)`,
        );
    }
}

function checkReExport(
    file: string,
    text: string,
    packageEntries: ReadonlySet<string>,
    problems: string[],
): void {
    const code = text.replaceAll(COMMENT, "");
    if (
        code.trim() !== "" &&
        code.replaceAll(RE_EXPORT, "").trim() === "" &&
        !packageEntries.has(file) &&
        !FEATURE_ENTRY.test(file)
    ) {
        problems.push(
            `${file}: re-export-only module; import from the defining modules instead`,
        );
    }
}

function checkRustTests(file: string, text: string, problems: string[]): void {
    const markers = text.match(/^#\[cfg\(test\)\]$/gmu)?.length ?? 0;
    if (markers === 0) {
        return;
    }
    const match = RUST_TEST_MODULE.exec(text);
    const closing = match === null ? -1 : text.indexOf("\n}\n", match.index);
    if (markers > 1 || match === null || closing + 3 !== text.length) {
        problems.push(
            `${file}: unit tests belong in one #[cfg(test)] mod tests, the last item in the file`,
        );
    }
}
