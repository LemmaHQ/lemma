import fs from "node:fs";
import path from "node:path";
import { generateDesktopTheme } from "./render-desktop.ts";
import { readRadii, readThemes, readTokenFile } from "./read-tokens.ts";

const output = process.argv[2];
if (output === undefined) {
    throw new Error("usage: node design/gen-desktop.ts <output.json>");
}
const tokensPath = path.join(import.meta.dirname, "tokens.json");
const tokens = readTokenFile(tokensPath);
const { themes } = readThemes(tokens, tokensPath);
const content = generateDesktopTheme(themes, readRadii(tokens, tokensPath));
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, content, "utf8");
