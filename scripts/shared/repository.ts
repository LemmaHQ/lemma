import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const ROOT_DIR = path.resolve(import.meta.dirname, "../..");

export function git(args: string[]): string {
    return execFileSync("git", args, {
        cwd: ROOT_DIR,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
    });
}

export function readText(file: string): string | null {
    const absolute = path.join(ROOT_DIR, file);
    return fs.existsSync(absolute)
        ? fs.readFileSync(absolute, "utf8").replaceAll("\r\n", "\n")
        : null;
}
