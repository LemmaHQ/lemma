import fs from "node:fs";
import path from "node:path";
import { readMotion, readRadii } from "./read-motion.ts";
import { readThemes } from "./read-theme.ts";
import { readTokenFile } from "./token-tree.ts";
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
    const tokens = readTokenFile(TOKENS_PATH);
    const { colors, themes } = readThemes(tokens, TOKENS_PATH);
    const motion = readMotion(tokens, TOKENS_PATH);
    const radii = readRadii(tokens, TOKENS_PATH);
    const outputs: [string, string][] = [
        [UI_CSS_PATH, generateWebCss(themes, motion, radii)],
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
