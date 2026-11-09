import type { Color, Motion, Theme, ThemeName } from "./read-tokens.ts";

const NOTICE =
    "Generated from design/tokens.json by design/gen-tokens.ts. Direct changes are overwritten by the generator.";

function cssBlock(
    selector: string,
    variables: Iterable<[string, string]>,
): string {
    const lines = [...variables].map(
        ([name, value]) => `    --${name}: ${value};`,
    );
    return `${selector} {\n${lines.join("\n")}\n}\n`;
}

export function generateWebCss(
    themes: Record<ThemeName, Theme>,
    motion: Motion,
): string {
    const motionVariables: [string, string][] = [
        ...[...motion.durations].map(
            ([name, milliseconds]): [string, string] => [
                `motion-duration-${name}`,
                `${milliseconds}ms`,
            ],
        ),
        ...[...motion.easings].map(([name, points]): [string, string] => [
            `motion-easing-${name}`,
            `cubic-bezier(${points.join(", ")})`,
        ]),
    ];
    return `/* ${NOTICE} */

${cssBlock(":root", motionVariables)}
${cssBlock(":root", themes.light)}
${cssBlock(".dark", themes.dark)}`;
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

export function generateAndroidKt(colors: Color[]): string {
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
