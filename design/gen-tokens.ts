import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const TOKENS_PATH = path.join(ROOT_DIR, "design/tokens.json");
const ANDROID_KT_PATH = path.join(
    ROOT_DIR,
    "mobile/shared/build/generated/source/tokens/dev/lemmahq/lemma/theme/LemmaPalette.kt",
);
const NOTICE =
    "Generated from design/tokens.json by design/gen-tokens.ts. Direct changes are overwritten by the generator.";
const HEX_COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/iu;

interface Color {
    name: string[];
    hex: string;
}

function collectColors(
    group: object,
    prefix: string[],
    colors: Color[],
): Color[] {
    for (const key of Object.keys(group)) {
        if (key.startsWith("$")) {
            continue;
        }
        const name = [...prefix, key];
        const node: unknown = Reflect.get(group, key);
        if (typeof node !== "object" || node === null) {
            throw new TypeError(`${name.join(".")} must be a token or group`);
        }
        if (!("$value" in node)) {
            collectColors(node, name, colors);
            continue;
        }
        const hex = node.$value;
        if (typeof hex !== "string" || !HEX_COLOR.test(hex)) {
            throw new Error(
                `${name.join(".")} must be a #rrggbb or #rrggbbaa color`,
            );
        }
        colors.push({ name, hex });
    }
    return colors;
}

function kotlinName(parts: string[]): string {
    return parts
        .flatMap((part) => part.split("-"))
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
}

function kotlinColor(hex: string): string {
    const digits = hex.slice(1).toUpperCase();
    const alpha = digits.length === 8 ? digits.slice(6) : "FF";
    return `Color(0x${alpha}${digits.slice(0, 6)})`;
}

function generateAndroidKt(colors: Color[]): string {
    const lines = colors.map(
        ({ name, hex }) => `    val ${kotlinName(name)} = ${kotlinColor(hex)}`,
    );
    return `// ${NOTICE}

package dev.lemmahq.lemma.theme

import androidx.compose.ui.graphics.Color

object LemmaPalette {
${lines.join("\n")}
}
`;
}

function main(): void {
    const tokens: unknown = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
    if (
        typeof tokens !== "object" ||
        tokens === null ||
        !("palette" in tokens) ||
        typeof tokens.palette !== "object" ||
        tokens.palette === null
    ) {
        throw new Error(`${TOKENS_PATH} must contain a palette group`);
    }
    const colors = collectColors(tokens.palette, [], []);
    fs.mkdirSync(path.dirname(ANDROID_KT_PATH), { recursive: true });
    fs.writeFileSync(ANDROID_KT_PATH, generateAndroidKt(colors), "utf8");
    console.log(`Generated ${path.relative(ROOT_DIR, ANDROID_KT_PATH)}`);
}

main();
