import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR } from "../shared/repository.ts";
import { readI18nSources } from "./read-i18n.ts";
import { renderAndroid } from "./render-android.ts";
import { renderWeb } from "./render-web.ts";

const SOURCE_DIR = path.join(ROOT_DIR, "i18n");
const LOCALE_DIR = path.join(ROOT_DIR, "web/src/i18n/locales");
const ANDROID_RESOURCE_DIR = path.join(
    ROOT_DIR,
    "mobile/shared/src/commonMain/composeResources",
);
const ANDROID_VALUE_DIRS = { en: "values", zh: "values-zh" } as const;

function main(): void {
    const entries = readI18nSources(SOURCE_DIR);
    const locales = renderWeb(entries);
    const android = renderAndroid(entries);
    for (const language of ["en", "zh"] as const) {
        write(
            path.join(LOCALE_DIR, `${language}.json`),
            `${JSON.stringify(locales[language], null, 4)}\n`,
        );
        write(
            path.join(
                ANDROID_RESOURCE_DIR,
                ANDROID_VALUE_DIRS[language],
                "strings.xml",
            ),
            android[language],
        );
    }
}

function write(file: string, content: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
    console.log(`Generated ${path.relative(ROOT_DIR, file)}`);
}

main();
