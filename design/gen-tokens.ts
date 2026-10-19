import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const TOKENS_PATH = path.join(ROOT_DIR, "design/tokens.json");
const WEB_CSS_PATH = path.join(ROOT_DIR, "web/src/styles/tokens.css");
const DESKTOP_TS_PATH = path.join(ROOT_DIR, "desktop/src/gen/design-tokens.ts");
const ANDROID_KT_PATH = path.join(
    ROOT_DIR,
    "mobile/shared/build/generated/source/tokens/dev/lemmahq/lemma/theme/LemmaPalette.kt",
);
const THEMES = ["light", "dark"] as const;
const NOTICE =
    "Generated from design/tokens.json by design/gen-tokens.ts. Direct changes are overwritten by the generator.";
const REFERENCE = /^\{([^}]+)\}$/u;

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
    fontFamily: string | string[];
    fontSize: string;
    fontWeight: number;
    lineHeight: number;
    letterSpacing: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTokenSource(value: unknown): value is TokenSource {
    return isRecord(value);
}

function stringValue(value: TokenValue, owner: string): string {
    if (typeof value !== "string") {
        throw new TypeError(`${owner} must be a string`);
    }
    return value;
}

function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) && value.every((item) => typeof item === "string")
    );
}

function stringArrayValue(value: TokenValue, owner: string): string[] {
    if (!isStringArray(value)) {
        throw new Error(`${owner} must be a list of strings`);
    }
    return value;
}

function isNumberArray(value: unknown): value is number[] {
    return (
        Array.isArray(value) && value.every((item) => typeof item === "number")
    );
}

function numberArrayValue(value: TokenValue, owner: string): number[] {
    if (!isNumberArray(value)) {
        throw new Error(`${owner} must be a list of numbers`);
    }
    return value;
}

function isShadowLayer(value: unknown): value is ShadowLayer {
    if (!isRecord(value)) {
        return false;
    }
    const { inset, offsetX, offsetY, blur, spread, color } = value;
    return (
        (inset === undefined || typeof inset === "boolean") &&
        typeof offsetX === "string" &&
        typeof offsetY === "string" &&
        typeof blur === "string" &&
        typeof spread === "string" &&
        typeof color === "string"
    );
}

function shadowValue(
    value: TokenValue,
    owner: string,
): ShadowLayer | ShadowLayer[] {
    if (isShadowLayer(value)) {
        return value;
    }
    if (Array.isArray(value)) {
        const layers = value.filter((layer): layer is ShadowLayer =>
            isShadowLayer(layer),
        );
        if (layers.length === value.length) {
            return layers;
        }
    }
    throw new Error(
        `${owner} must be a shadow layer or a list of shadow layers`,
    );
}

function isTypographyValue(value: unknown): value is TypographyValue {
    if (!isRecord(value)) {
        return false;
    }
    const { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing } =
        value;
    return (
        (typeof fontFamily === "string" || isStringArray(fontFamily)) &&
        typeof fontSize === "string" &&
        typeof fontWeight === "number" &&
        typeof lineHeight === "number" &&
        typeof letterSpacing === "string"
    );
}

function typographyValue(value: TokenValue, owner: string): TypographyValue {
    if (!isTypographyValue(value)) {
        throw new Error(`${owner} must be a typography token`);
    }
    return value;
}

function collectTokens(
    source: TokenSource,
    prefix: string[],
    inheritedType: string | undefined,
    tokens: TokenMap,
): TokenMap {
    const type = source.$type ?? inheritedType;
    for (const [key, node] of Object.entries(source)) {
        if (key.startsWith("$")) {
            continue;
        }
        if (!isTokenSource(node)) {
            throw new Error(
                `${[...prefix, key].join(".")} must be a token or group`,
            );
        }
        const name = [...prefix, key];
        if ("$value" in node) {
            tokens.set(name.join("."), {
                name,
                type: node.$type ?? type,
                value: node.$value,
            });
        } else {
            collectTokens(node, name, type, tokens);
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
        if (match === null) {
            return value;
        }
        const reference = match[1];
        if (reference === undefined) {
            throw new Error(`${owner} references missing token ${value}`);
        }
        const target = tokens.get(reference);
        if (target === undefined) {
            throw new Error(`${owner} references missing token ${value}`);
        }
        return resolveValue(target.value, tokens, reference);
    }
    if (Array.isArray(value)) {
        return value.map((item) => resolveValue(item, tokens, owner));
    }
    if (isRecord(value)) {
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

function pxNumber(px: string): number {
    // oxlint-disable-next-line unicorn/prefer-number-coercion -- token values carry a px unit suffix, so Number() would yield NaN
    return Number.parseFloat(px);
}

function pxToRem(px: string): string {
    return `${pxNumber(px) / 16}rem`;
}

function pxToEm(letterSpacing: string, fontSize: string): string {
    const spacing = pxNumber(letterSpacing);
    if (spacing === 0) {
        return "0";
    }
    return `${Number((spacing / pxNumber(fontSize)).toFixed(4))}em`;
}

function cssFontFamily(families: string[]): string {
    return families
        .map((family) => (/\s/u.test(family) ? `"${family}"` : family))
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
        lines.push(
            `    --${key}: ${stringValue(token.value, `${theme}.color.${key}`)};`,
        );
    }
    for (const [key, token] of group(tokens, `${theme}.shadow`)) {
        lines.push(
            `    --elevation-${key}: ${cssShadow(shadowValue(token.value, `${theme}.shadow.${key}`))};`,
        );
    }
    return lines;
}

function generateWebCss(tokens: TokenMap): string {
    const [light, ...darkThemes] = THEMES;
    const rootLines = themeDeclarations(tokens, light);
    rootLines.push("");
    for (const [key, token] of group(tokens, "duration")) {
        rootLines.push(
            `    --motion-${key}: ${stringValue(token.value, `duration.${key}`)};`,
        );
    }
    for (const [key, token] of group(tokens, "easing")) {
        rootLines.push(
            `    --ease-${key}: cubic-bezier(${numberArrayValue(token.value, `easing.${key}`).join(", ")});`,
        );
    }

    const themeLines: string[] = [];
    for (const [key] of group(tokens, `${light}.color`)) {
        themeLines.push(`    --color-${key}: var(--${key});`);
    }
    themeLines.push("", "    /* font */");
    for (const [key, token] of group(tokens, "font")) {
        themeLines.push(
            `    --font-${key}: ${cssFontFamily(stringArrayValue(token.value, `font.${key}`))};`,
        );
    }
    themeLines.push("", "    /* shadow */");
    for (const [key] of group(tokens, `${light}.shadow`)) {
        themeLines.push(`    --shadow-${key}: var(--elevation-${key});`);
    }

    themeLines.push("", "    /* typography */");
    const bodySm = tokens.get("typography.body-sm");
    if (bodySm !== undefined) {
        const bodySmValue = typographyValue(bodySm.value, "typography.body-sm");
        themeLines.push(
            `    --text-sm: ${pxToRem(bodySmValue.fontSize)};`,
            `    --text-sm--line-height: ${bodySmValue.lineHeight};`,
        );
    }
    for (const [key, token] of group(tokens, "typography")) {
        const { fontSize, fontWeight, lineHeight, letterSpacing } =
            typographyValue(token.value, `typography.${key}`);
        themeLines.push(
            `    --text-${key}: ${pxToRem(fontSize)};`,
            `    --text-${key}--line-height: ${lineHeight};`,
        );
        const spacing = pxToEm(letterSpacing, fontSize);
        if (spacing !== "0") {
            themeLines.push(`    --text-${key}--letter-spacing: ${spacing};`);
        }
        themeLines.push(`    --text-${key}--font-weight: ${fontWeight};`);
    }

    themeLines.push("", "    /* radius */");
    const radiusLg = tokens.get("radius.lg");
    if (radiusLg !== undefined) {
        themeLines.push(
            `    --radius: ${pxToRem(stringValue(radiusLg.value, "radius.lg"))};`,
        );
    }
    for (const [key, token] of group(tokens, "radius")) {
        themeLines.push(
            `    --radius-${key}: ${stringValue(token.value, `radius.${key}`)};`,
        );
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
            `    val ${kotlinName(token.name.slice(1))} = ${kotlinColor(stringValue(token.value, token.name.join(".")))}`,
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
    const parsed: unknown = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
    if (!isTokenSource(parsed)) {
        throw new Error(`${TOKENS_PATH} must contain a token tree`);
    }
    const tokens = resolveAll(
        collectTokens(parsed, [], undefined, new Map<string, Token>()),
    );
    checkThemeParity(tokens);
    writeOutput(WEB_CSS_PATH, generateWebCss(tokens));
    writeOutput(DESKTOP_TS_PATH, generateDesktopTs(tokens));
    writeOutput(ANDROID_KT_PATH, generateAndroidKt(tokens));
}

main();
