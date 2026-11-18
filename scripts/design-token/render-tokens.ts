import type { Motion } from "./read-motion.ts";
import { THEMES, WINDOW_ROLES } from "./read-theme.ts";
import type { Theme, ThemeName } from "./read-theme.ts";
import type { TextStyle } from "./read-typography.ts";

const NOTICE =
    "Generated from design/tokens.json by scripts/design-token/gen-tokens.ts. Direct changes are overwritten by the generator.";

const ROOT_FONT_PIXELS = 16;

function cssBlock(
    selector: string,
    variables: Iterable<[string, string]>,
): string {
    const lines = [...variables].map(
        ([name, value]) => `    --${name}: ${value};`,
    );
    return `${selector} {\n${lines.join("\n")}\n}\n`;
}

function rem(pixels: number): string {
    return `${pixels / ROOT_FONT_PIXELS}rem`;
}

function typographyVariables(
    typography: Map<string, TextStyle>,
): [string, string][] {
    const variables: [string, string][] = [];
    for (const [name, style] of typography) {
        variables.push(
            [`text-${name}`, rem(style.fontSize)],
            [`text-${name}--line-height`, rem(style.lineHeight)],
        );
        if (style.fontWeight !== undefined) {
            variables.push([
                `text-${name}--font-weight`,
                `${style.fontWeight}`,
            ]);
        }
    }
    return variables;
}

export function generateWebCss(
    themes: Record<ThemeName, Theme>,
    motion: Motion,
    radii: Map<string, number>,
    typography: Map<string, TextStyle>,
): string {
    const themeVariables: [string, string][] = [
        ...[...radii].map(([name, pixels]): [string, string] => [
            `radius-${name}`,
            `${pixels}px`,
        ]),
        ...typographyVariables(typography),
    ];
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

${cssBlock("@theme", themeVariables)}
${cssBlock(":root", motionVariables)}
${cssBlock(':root, [data-theme-preview="light"]', themes.light)}
${cssBlock('.dark, [data-theme-preview="dark"]', themes.dark)}`;
}

export function generateDesktopTs(themes: Record<ThemeName, Theme>): string {
    const entry = (themeName: ThemeName): string => {
        const colors = WINDOW_ROLES.map(
            (role) => `${role}: "${themes[themeName].get(role)}"`,
        );
        return `    ${themeName}: { ${colors.join(", ")} },`;
    };
    return `// ${NOTICE}

export const themeColors = {
${THEMES.map(entry).join("\n")}
} as const;
`;
}

function kotlinName(name: string): string {
    return name.replaceAll(/-(\w)/gu, (_, letter: string) =>
        letter.toUpperCase(),
    );
}

function kotlinColor(hex: string): string {
    const digits = hex.slice(1).toUpperCase();
    const alpha = digits.length === 8 ? digits.slice(6) : "FF";
    return `Color(0x${alpha}${digits.slice(0, 6)})`;
}

function kotlinScheme(themeName: ThemeName, theme: Theme): string {
    const roles = [...theme].map(
        ([role, hex]) => `        ${kotlinName(role)} = ${kotlinColor(hex)},`,
    );
    return `val ${themeName === "light" ? "Light" : "Dark"}LemmaColorScheme =
    LemmaColorScheme(
        isDark = ${themeName === "dark"},
${roles.join("\n")}
    )`;
}

function kotlinTextStyle(style: TextStyle): string {
    const weight =
        style.fontWeight === undefined
            ? ""
            : `, fontWeight = FontWeight(${style.fontWeight})`;
    return `TextStyle(fontSize = ${style.fontSize}.sp, lineHeight = ${style.lineHeight}.sp${weight})`;
}

/** Renders `LemmaTokens.kt`: the color schemes, type styles, and corner shapes of the Android theme. */
export function generateAndroidKt(
    themes: Record<ThemeName, Theme>,
    typography: Map<string, TextStyle>,
    radii: Map<string, number>,
): string {
    const roles = [...themes.light.keys()].map(
        (role) => `    val ${kotlinName(role)}: Color,`,
    );
    const styles = [...typography].map(
        ([name, style]) =>
            `    val ${kotlinName(name)}: TextStyle = ${kotlinTextStyle(style)},`,
    );
    const shapes = [...radii].map(
        ([name, pixels]) =>
            `    val ${kotlinName(name)}: RoundedCornerShape = RoundedCornerShape(${pixels}.dp),`,
    );
    const usesWeight = [...typography.values()].some(
        (style) => style.fontWeight !== undefined,
    );
    const imports = [
        "androidx.compose.foundation.shape.RoundedCornerShape",
        "androidx.compose.runtime.Immutable",
        "androidx.compose.ui.graphics.Color",
        "androidx.compose.ui.text.TextStyle",
        ...(usesWeight ? ["androidx.compose.ui.text.font.FontWeight"] : []),
        "androidx.compose.ui.unit.dp",
        "androidx.compose.ui.unit.sp",
    ];
    return `// ${NOTICE}

package io.github.mistvesper.lemma.theme

${imports.map((name) => `import ${name}`).join("\n")}

/** The color roles of one theme; [isDark] marks the dark scheme for content that picks its own colors. */
@Immutable
data class LemmaColorScheme(
    val isDark: Boolean,
${roles.join("\n")}
)

${kotlinScheme("light", themes.light)}

${kotlinScheme("dark", themes.dark)}

/** The type scale; sizes match the web's \`text-*\` roles. */
@Immutable
data class LemmaTypography(
${styles.join("\n")}
)

/** The corner radius scale. */
@Immutable
data class LemmaShapes(
${shapes.join("\n")}
)
`;
}
