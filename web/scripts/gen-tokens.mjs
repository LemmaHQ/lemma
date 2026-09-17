import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const DESIGN_MD_PATH = path.join(ROOT_DIR, "DESIGN.md");
const OUTPUT_CSS_PATH = path.join(ROOT_DIR, "web/src/styles/tokens.css");

function parseDesignTokens() {
    const raw = fs.readFileSync(DESIGN_MD_PATH, "utf8");
    const parsed = matter(raw);
    return parsed.data;
}

function pxToRem(pxStr) {
    const px = Number.parseFloat(pxStr);
    return `${px / 16}rem`;
}

function pxToEm(letterSpacingPx, fontSizePx) {
    const ls = Number.parseFloat(letterSpacingPx);
    const fs = Number.parseFloat(fontSizePx);
    if (!ls || ls === 0) return "0";
    const em = ls / fs;
    const rounded = Number(em.toFixed(4));
    return `${rounded}em`;
}

function generateTokensCss(data) {
    const colors = data.colors || {};
    const typography = data.typography || {};
    const rounded = data.rounded || {};

    const lightColors = [];
    const darkColors = [];
    const themeColorMappings = [];

    for (const [key, val] of Object.entries(colors)) {
        if (key.startsWith("dark-")) {
            const cleanKey = key.replace(/^dark-/, "");
            darkColors.push(`    --${cleanKey}: ${val};`);
        } else {
            lightColors.push(`    --${key}: ${val};`);
            themeColorMappings.push(`    --color-${key}: var(--${key});`);
        }
    }

    const typographyTokens = [];
    for (const [name, def] of Object.entries(typography)) {
        const remSize = pxToRem(def.fontSize);
        const emSpacing = pxToEm(def.letterSpacing, def.fontSize);
        typographyTokens.push(`    --text-${name}: ${remSize};`);
        typographyTokens.push(
            `    --text-${name}--line-height: ${def.lineHeight};`,
        );
        if (emSpacing !== "0") {
            typographyTokens.push(
                `    --text-${name}--letter-spacing: ${emSpacing};`,
            );
        }
        if (def.fontWeight) {
            typographyTokens.push(
                `    --text-${name}--font-weight: ${def.fontWeight};`,
            );
        }
    }

    const bodySm = typography["body-sm"];
    if (bodySm) {
        typographyTokens.unshift(
            `    --text-sm: ${pxToRem(bodySm.fontSize)};`,
            `    --text-sm--line-height: ${bodySm.lineHeight};`,
        );
    }

    const radiusTokens = rounded.lg
        ? [`    --radius: ${pxToRem(rounded.lg)};`]
        : [];
    for (const [name, val] of Object.entries(rounded)) {
        radiusTokens.push(`    --radius-${name}: ${val};`);
    }

    const motion = data.motion || {};
    const motionTokens = [];
    for (const [name, val] of Object.entries(motion.duration || {})) {
        motionTokens.push(`    --motion-${name}: ${val};`);
    }
    for (const [name, val] of Object.entries(motion.easing || {})) {
        motionTokens.push(`    --ease-${name}: ${val};`);
    }

    return `/* Generated from DESIGN.md by web/scripts/gen-tokens.mjs. Do not edit manually. */

:root {
${lightColors.join("\n")}

${motionTokens.join("\n")}
}

[data-theme="dark"] {
${darkColors.join("\n")}
}

@theme inline {
${themeColorMappings.join("\n")}

    /* typography */
${typographyTokens.join("\n")}

    /* radius */
${radiusTokens.join("\n")}
}
`;
}

function main() {
    const data = parseDesignTokens();
    const css = generateTokensCss(data);
    fs.mkdirSync(path.dirname(OUTPUT_CSS_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_CSS_PATH, css, "utf8");
    console.log(`Generated tokens: ${OUTPUT_CSS_PATH}`);
}

main();
