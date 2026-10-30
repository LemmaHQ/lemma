import fs from "node:fs";
import path from "node:path";
import {
    checkThemesMatch,
    collectColors,
    readGroup,
    readMotion,
    resolveTheme,
} from "./read-tokens.ts";
import {
    generateAndroidKt,
    generateDesktopTs,
    generateWebCss,
} from "./render-tokens.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const TOKENS_PATH = path.join(ROOT_DIR, "design/tokens.json");
const UI_CSS_PATH = path.join(
    ROOT_DIR,
    "packages/ui/src/styles/tokens.gen.css",
);
const DESKTOP_TS_PATH = path.join(ROOT_DIR, "desktop/src/gen/theme-colors.ts");
const ANDROID_KT_PATH = path.join(
    ROOT_DIR,
    "mobile/shared/build/generated/source/tokens/dev/lemmahq/lemma/theme/LemmaPalette.kt",
);

function main(): void {
    const tokens: unknown = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
    if (typeof tokens !== "object" || tokens === null) {
        throw new Error(`${TOKENS_PATH} must contain a token tree`);
    }
    const colors = collectColors(
        readGroup(tokens, "palette", TOKENS_PATH),
        [],
        [],
    );
    const palette = new Map(
        colors.map(({ name, hex }) => [name.join("."), hex]),
    );
    const themes = {
        light: resolveTheme(
            readGroup(tokens, "light", TOKENS_PATH),
            "light",
            palette,
        ),
        dark: resolveTheme(
            readGroup(tokens, "dark", TOKENS_PATH),
            "dark",
            palette,
        ),
    };
    checkThemesMatch(themes.light, themes.dark);
    const motion = readMotion(tokens, TOKENS_PATH);
    const outputs: [string, string][] = [
        [UI_CSS_PATH, generateWebCss(themes, motion)],
        [DESKTOP_TS_PATH, generateDesktopTs(themes)],
        [ANDROID_KT_PATH, generateAndroidKt(colors)],
    ];
    for (const [file, content] of outputs) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content, "utf8");
        console.log(`Generated ${path.relative(ROOT_DIR, file)}`);
    }
}

main();
