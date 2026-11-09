import fs from "node:fs";
import path from "node:path";
import { readI18nSources } from "./read-i18n.ts";
import { renderDesktop } from "./render-desktop.ts";

const output = process.argv[2];
if (output === undefined) {
    throw new Error("usage: node i18n/gen-desktop.ts <output.rs>");
}
const entries = readI18nSources(import.meta.dirname);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, renderDesktop(entries), "utf8");
