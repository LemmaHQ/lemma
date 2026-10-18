import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const TOKENS_PATH = path.join(ROOT_DIR, "design/tokens.json");
const WEB_CSS_PATH = path.join(ROOT_DIR, "web/src/styles/tokens.css");
const DESKTOP_TS_PATH = path.join(ROOT_DIR, "desktop/src/gen/design-tokens.ts");
const ANDROID_KT_PATH = path.join(
    ROOT_DIR,
    "mobile/shared/build/generated/source/tokens/dev/lemmahq/lemma/theme/LemmaPalette.kt",
);
const THEMES = ["light", "dark"];
const NOTICE =
    "Generated from design/tokens.json by design/gen-tokens.ts. Direct changes are overwritten by the generator.";
const REFERENCE = /^\{([^}]+)\}$/;

type TokenValue =
    string | number | boolean | TokenValue[] | { [key: string]: TokenValue };

interface TokenSource {
    $type?: string;
    $value?: TokenValue;
    [key: string]: unknown;
}

interface Token {
    name: string[];
    type: string | undefined;
    value: TokenValue;
}

type TokenMap = Map<string, Token>;

interface ShadowLayer {
    [key: string]: TokenValue;
    inset: boolean;
    offsetX: string;
    offsetY: string;
    blur: string;
    spread: string;
    color: string;
}

interface TypographyValue {
    [key: string]: TokenValue;
    fontFamily: string;
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
    letterSpacing: string;
}

function collectTokens(
    group: TokenSource,
    prefix: string[],
    inheritedType: string | undefined,
    tokens: TokenMap,
): TokenMap {
    const type = group.$type ?? inheritedType;
    for (const [key, node] of Object.entries(group)) {
        if (key.startsWith("$")) {
            continue;
        }
        const child = node as TokenSource;
        const name = [...prefix, key];
        if ("$value" in child) {
            tokens.set(name.join("."), {
                name,
                type: child.$type ?? type,
                value: child.$value as TokenValue,
            });
        } else {
            collectTokens(child, name, type, tokens);
        }
    }
    return tokens;
}

function resolveValue(
    value: TokenValue,
    tokens: TokenMap,
    owner: string,
): TokenValue {
    if (typeof value === "string") {
        const match = REFERENCE.exec(value);
        if (!match) {
            return value;
        }
        const target = tokens.get(match[1] as string);
        if (!target) {
            throw new Error(`${owner} references missing token ${value}`);
        }
        return resolveValue(target.value, tokens, match[1] as string);
    }
    if (Array.isArray(value)) {
        return value.map((item) => resolveValue(item, tokens, owner));
    }
    if (typeof value === "object" && value !== null) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                resolveValue(item, tokens, owner),
            ]),
        );
    }
    return value;
}

function resolveAll(tokens: TokenMap): TokenMap {
    const resolved: TokenMap = new Map();
    for (const [key, token] of tokens) {
        resolved.set(key, {
            ...token,
            value: resolveValue(token.value, tokens, key),
        });
    }
    return resolved;
}

function group(tokens: TokenMap, prefix: string): [string, Token][] {
    const entries: [string, Token][] = [];
    const head = `${prefix}.`;
    for (const [key, token] of tokens) {
        if (key.startsWith(head)) {
            entries.push([key.slice(head.length), token]);
        }
    }
    return entries;
}

function checkThemeParity(tokens: TokenMap): void {
    const [first, ...rest] = THEMES;
    const reference = new Set(group(tokens, first).map(([key]) => key));
    for (const theme of rest) {
        const keys = new Set(group(tokens, theme).map(([key]) => key));
        for (const key of keys) {
            if (!reference.has(key)) {
                throw new Error(
                    `${theme}.${key} has no counterpart in ${first}`,
                );
            }
        }
        for (const key of reference) {
            if (!keys.has(key)) {
                throw new Error(
                    `${first}.${key} has no counterpart in ${theme}`,
                );
            }
        }
    }
}

function pxToRem(px: string): string {
    return `${Number.parseFloat(px) / 16}rem`;
}

function pxToEm(letterSpacing: string, fontSize: string): string {
    const spacing = Number.parseFloat(letterSpacing);
    if (!spacing) {
        return "0";
    }
    return `${Number((spacing / Number.parseFloat(fontSize)).toFixed(4))}em`;
}

function cssFontFamily(families: string[]): string {
    return families
        .map((family) => (/\s/.test(family) ? `"${family}"` : family))
        .join(", ");
}

function cssShadow(value: ShadowLayer | ShadowLayer[]): string {
    const layers = Array.isArray(value) ? value : [value];
    return layers
        .map((layer) =>
            [
                layer.inset ? "inset" : null,
                layer.offsetX,
                layer.offsetY,
                layer.blur,
                layer.spread,
                layer.color,
            ]
                .filter(Boolean)
                .join(" "),
        )
        .join(", ");
}

function themeDeclarations(tokens: TokenMap, theme: string): string[] {
    const lines: string[] = [];
    for (const [key, token] of group(tokens, `${theme}.color`)) {
        lines.push(`    --${key}: ${token.value};`);
    }
    for (const [key, token] of group(tokens, `${theme}.shadow`)) {
        lines.push(
            `    --elevation-${key}: ${cssShadow(token.value as ShadowLayer | ShadowLayer[])};`,
        );
    }
    return lines;
}

function generateWebCss(tokens: TokenMap): string {
    const [light, ...darkThemes] = THEMES;
    const rootLines = themeDeclarations(tokens, light);
    rootLines.push("");
    for (const [key, token] of group(tokens, "duration")) {
        rootLines.push(`    --motion-${key}: ${token.value};`);
    }
    for (const [key, token] of group(tokens, "easing")) {
        rootLines.push(
            `    --ease-${key}: cubic-bezier(${(token.value as number[]).join(", ")});`,
        );
    }

    const themeLines: string[] = [];
    for (const [key] of group(tokens, `${light}.color`)) {
        themeLines.push(`    --color-${key}: var(--${key});`);
    }
    themeLines.push("", "    /* font */");
    for (const [key, token] of group(tokens, "font")) {
        themeLines.push(
            `    --font-${key}: ${cssFontFamily(token.value as string[])};`,
        );
    }
    themeLines.push("", "    /* shadow */");
    for (const [key] of group(tokens, `${light}.shadow`)) {
        themeLines.push(`    --shadow-${key}: var(--elevation-${key});`);
    }

    themeLines.push("", "    /* typography */");
    const bodySm = tokens.get("typography.body-sm");
    if (bodySm) {
        const bodySmValue = bodySm.value as TypographyValue;
        themeLines.push(
            `    --text-sm: ${pxToRem(bodySmValue.fontSize)};`,
            `    --text-sm--line-height: ${bodySmValue.lineHeight};`,
        );
    }
    for (const [key, token] of group(tokens, "typography")) {
        const { fontSize, fontWeight, lineHeight, letterSpacing } =
            token.value as TypographyValue;
        themeLines.push(`    --text-${key}: ${pxToRem(fontSize)};`);
        themeLines.push(`    --text-${key}--line-height: ${lineHeight};`);
        const spacing = pxToEm(letterSpacing, fontSize);
        if (spacing !== "0") {
            themeLines.push(`    --text-${key}--letter-spacing: ${spacing};`);
        }
        themeLines.push(`    --text-${key}--font-weight: ${fontWeight};`);
    }

    themeLines.push("", "    /* radius */");
    const radiusLg = tokens.get("radius.lg");
    if (radiusLg) {
        themeLines.push(`    --radius: ${pxToRem(radiusLg.value as string)};`);
    }
    for (const [key, token] of group(tokens, "radius")) {
        themeLines.push(`    --radius-${key}: ${token.value};`);
    }

    const darkBlocks = darkThemes.map(
        (theme) =>
            `[data-theme="${theme}"] {\n${themeDeclarations(tokens, theme).join("\n")}\n}\n`,
    );

    return `/* ${NOTICE} */

:root {
${rootLines.join("\n")}
}

${darkBlocks.join("\n")}
@theme inline {
${themeLines.join("\n")}
}
`;
}

function generateDesktopTs(tokens: TokenMap): string {
    const colors = Object.fromEntries(
        THEMES.map((theme) => [
            theme,
            Object.fromEntries(
                group(tokens, `${theme}.color`).map(([key, token]) => [
                    key,
                    token.value,
                ]),
            ),
        ]),
    );
    return `// ${NOTICE}

export const themeColors = ${JSON.stringify(colors, null, 4)} as const;
`;
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

function generateAndroidKt(tokens: TokenMap): string {
    const lines = group(tokens, "palette").map(
        ([, token]) =>
            `    val ${kotlinName(token.name.slice(1))} = ${kotlinColor(token.value as string)}`,
    );
    return `// ${NOTICE}

package dev.lemmahq.lemma.theme

import androidx.compose.ui.graphics.Color

object LemmaPalette {
${lines.join("\n")}
}
`;
}

function writeOutput(file: string, content: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
    console.log(`Generated ${path.relative(ROOT_DIR, file)}`);
}

function main(): void {
    const source = JSON.parse(
        fs.readFileSync(TOKENS_PATH, "utf8"),
    ) as TokenSource;
    const tokens = resolveAll(
        collectTokens(source, [], undefined, new Map<string, Token>()),
    );
    checkThemeParity(tokens);
    writeOutput(WEB_CSS_PATH, generateWebCss(tokens));
    writeOutput(DESKTOP_TS_PATH, generateDesktopTs(tokens));
    writeOutput(ANDROID_KT_PATH, generateAndroidKt(tokens));
}

main();
