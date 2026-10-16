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
    "Generated from design/tokens.json by design/gen-tokens.mjs. Direct changes are overwritten by the generator.";
const REFERENCE = /^\{([^}]+)\}$/;

function collectTokens(group, prefix, inheritedType, tokens) {
    const type = group.$type ?? inheritedType;
    for (const [key, node] of Object.entries(group)) {
        if (key.startsWith("$")) {
            continue;
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

function resolveValue(value, tokens, owner) {
    if (typeof value === "string") {
        const match = REFERENCE.exec(value);
        if (!match) {
            return value;
        }
        const target = tokens.get(match[1]);
        if (!target) {
            throw new Error(`${owner} references missing token ${value}`);
        }
        return resolveValue(target.value, tokens, match[1]);
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

function resolveAll(tokens) {
    const resolved = new Map();
    for (const [key, token] of tokens) {
        resolved.set(key, {
            ...token,
            value: resolveValue(token.value, tokens, key),
        });
    }
    return resolved;
}

function group(tokens, prefix) {
    const entries = [];
    const head = `${prefix}.`;
    for (const [key, token] of tokens) {
        if (key.startsWith(head)) {
            entries.push([key.slice(head.length), token]);
        }
    }
    return entries;
}

function checkThemeParity(tokens) {
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

function pxToRem(px) {
    return `${Number.parseFloat(px) / 16}rem`;
}

function pxToEm(letterSpacing, fontSize) {
    const spacing = Number.parseFloat(letterSpacing);
    if (!spacing) {
        return "0";
    }
    return `${Number((spacing / Number.parseFloat(fontSize)).toFixed(4))}em`;
}

function cssFontFamily(families) {
    return families
        .map((family) => (/\s/.test(family) ? `"${family}"` : family))
        .join(", ");
}

function cssShadow(value) {
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

function themeDeclarations(tokens, theme) {
    const lines = [];
    for (const [key, token] of group(tokens, `${theme}.color`)) {
        lines.push(`    --${key}: ${token.value};`);
    }
    for (const [key, token] of group(tokens, `${theme}.shadow`)) {
        lines.push(`    --elevation-${key}: ${cssShadow(token.value)};`);
    }
    return lines;
}

function generateWebCss(tokens) {
    const [light, ...darkThemes] = THEMES;
    const rootLines = themeDeclarations(tokens, light);
    rootLines.push("");
    for (const [key, token] of group(tokens, "duration")) {
        rootLines.push(`    --motion-${key}: ${token.value};`);
    }
    for (const [key, token] of group(tokens, "easing")) {
        rootLines.push(
            `    --ease-${key}: cubic-bezier(${token.value.join(", ")});`,
        );
    }

    const themeLines = [];
    for (const [key] of group(tokens, `${light}.color`)) {
        themeLines.push(`    --color-${key}: var(--${key});`);
    }
    themeLines.push("", "    /* font */");
    for (const [key, token] of group(tokens, "font")) {
        themeLines.push(`    --font-${key}: ${cssFontFamily(token.value)};`);
    }
    themeLines.push("", "    /* shadow */");
    for (const [key] of group(tokens, `${light}.shadow`)) {
        themeLines.push(`    --shadow-${key}: var(--elevation-${key});`);
    }

    themeLines.push("", "    /* typography */");
    const bodySm = tokens.get("typography.body-sm");
    if (bodySm) {
        themeLines.push(
            `    --text-sm: ${pxToRem(bodySm.value.fontSize)};`,
            `    --text-sm--line-height: ${bodySm.value.lineHeight};`,
        );
    }
    for (const [key, token] of group(tokens, "typography")) {
        const { fontSize, fontWeight, lineHeight, letterSpacing } = token.value;
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
        themeLines.push(`    --radius: ${pxToRem(radiusLg.value)};`);
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

function generateDesktopTs(tokens) {
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

function kotlinName(parts) {
    return parts
        .flatMap((part) => part.split("-"))
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
}

function kotlinColor(hex) {
    const digits = hex.slice(1).toUpperCase();
    const alpha = digits.length === 8 ? digits.slice(6) : "FF";
    return `Color(0x${alpha}${digits.slice(0, 6)})`;
}

function generateAndroidKt(tokens) {
    const lines = group(tokens, "palette").map(
        ([, token]) =>
            `    val ${kotlinName(token.name.slice(1))} = ${kotlinColor(token.value)}`,
    );
    return `// ${NOTICE}

package dev.lemmahq.lemma.theme

import androidx.compose.ui.graphics.Color

object LemmaPalette {
${lines.join("\n")}
}
`;
}

function writeOutput(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
    console.log(`Generated ${path.relative(ROOT_DIR, file)}`);
}

function main() {
    const source = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
    const tokens = resolveAll(collectTokens(source, [], undefined, new Map()));
    checkThemeParity(tokens);
    writeOutput(WEB_CSS_PATH, generateWebCss(tokens));
    writeOutput(DESKTOP_TS_PATH, generateDesktopTs(tokens));
    writeOutput(ANDROID_KT_PATH, generateAndroidKt(tokens));
}

main();
