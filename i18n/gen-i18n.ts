import fs from "node:fs";
import path from "node:path";
import { readI18nSources } from "./read-i18n.ts";
import { renderWeb } from "./render-web.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const SOURCE_DIR = path.join(ROOT_DIR, "i18n");
const LOCALE_DIR = path.join(ROOT_DIR, "web/src/i18n/locales");

function main(): void {
    const entries = readI18nSources(SOURCE_DIR);
    const locales = renderWeb(entries);
    fs.mkdirSync(LOCALE_DIR, { recursive: true });
    for (const language of ["en", "zh"] as const) {
        const file = path.join(LOCALE_DIR, `${language}.json`);
        const content = `${JSON.stringify(locales[language], null, 4)}\n`;
        fs.writeFileSync(file, content, "utf8");
        console.log(`Generated ${path.relative(ROOT_DIR, file)}`);
    }
}

main();
