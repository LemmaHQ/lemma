import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const TOKENS_PATH = path.join(ROOT_DIR, "design/tokens.json");
const WEB_CSS_PATH = path.join(ROOT_DIR, "web/src/tokens.css");
const DESKTOP_TS_PATH = path.join(ROOT_DIR, "desktop/src/gen/theme-colors.ts");
const ANDROID_KT_PATH = path.join(
    ROOT_DIR,
    "mobile/shared/build/generated/source/tokens/dev/lemmahq/lemma/theme/LemmaPalette.kt",
);
const NOTICE =
    "Generated from design/tokens.json by design/gen-tokens.ts. Direct changes are overwritten by the generator.";
const HEX_COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const PALETTE_REFERENCE = /^\{palette\.(.+)\}$/u;
const THEMES = ["light", "dark"] as const;
const WINDOW_ROLES = ["background", "sidebar", "foreground"] as const;

type ThemeName = (typeof THEMES)[number];
type Theme = Map<string, string>;

interface Color {
    name: string[];
    hex: string;
}

interface Motion {
    durations: Map<string, number>;
    easings: Map<string, number[]>;
}

function readGroup(parent: object, key: string, label: string): object {
    const group: unknown = Reflect.get(parent, key);
    if (typeof group !== "object" || group === null) {
        throw new Error(`${label} must contain a ${key} group`);
    }
    return group;
}

function tokenKeys(group: object): string[] {
    return Object.keys(group).filter((key) => !key.startsWith("$"));
}

function collectColors(
    group: object,
    prefix: string[],
    colors: Color[],
): Color[] {
    for (const key of tokenKeys(group)) {
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

function resolveTheme(
    group: object,
    themeName: ThemeName,
    palette: Map<string, string>,
): Theme {
    const theme: Theme = new Map();
    for (const role of tokenKeys(group)) {
        const node: unknown = Reflect.get(group, role);
        const value =
            typeof node === "object" && node !== null && "$value" in node
                ? node.$value
                : undefined;
        const reference =
            typeof value === "string"
                ? PALETTE_REFERENCE.exec(value)?.[1]
                : undefined;
        const hex =
            reference === undefined ? undefined : palette.get(reference);
        if (hex === undefined) {
            throw new Error(
                `${themeName}.${role} must reference a palette color as {palette.<name>}`,
            );
        }
        theme.set(role, hex);
    }
    return theme;
}

function checkThemesMatch(light: Theme, dark: Theme): void {
    const missing = [
        ...[...light.keys()].filter((role) => !dark.has(role)),
        ...[...dark.keys()].filter((role) => !light.has(role)),
    ];
    if (missing.length > 0) {
        throw new Error(
            `light and dark must define the same roles; mismatched: ${missing.join(", ")}`,
        );
    }
    for (const role of WINDOW_ROLES) {
        if (!light.has(role)) {
            throw new Error(`light and dark must define ${role}`);
        }
    }
}

function readTokenValues(group: object, label: string): Map<string, unknown> {
    const values = new Map<string, unknown>();
    for (const key of tokenKeys(group)) {
        const node: unknown = Reflect.get(group, key);
        if (typeof node !== "object" || node === null || !("$value" in node)) {
            throw new Error(`${label}.${key} must be a token with a $value`);
        }
        values.set(key, node.$value);
    }
    return values;
}

function readDurations(group: object): Map<string, number> {
    const durations = new Map<string, number>();
    for (const [name, value] of readTokenValues(group, "motion.duration")) {
        const isObject = typeof value === "object" && value !== null;
        const amount: unknown = isObject
            ? Reflect.get(value, "value")
            : undefined;
        const unit: unknown = isObject ? Reflect.get(value, "unit") : undefined;
        if (typeof amount !== "number" || amount < 0 || unit !== "ms") {
            throw new Error(
                `motion.duration.${name} must be { "value": <milliseconds>, "unit": "ms" }`,
            );
        }
        durations.set(name, amount);
    }
    return durations;
}

function isCubicBezier(value: unknown): value is number[] {
    if (!Array.isArray(value) || value.length !== 4) {
        return false;
    }
    const points: unknown[] = value;
    const [x1, , x2] = points;
    return (
        points.every(
            (point) => typeof point === "number" && Number.isFinite(point),
        ) &&
        typeof x1 === "number" &&
        typeof x2 === "number" &&
        x1 >= 0 &&
        x1 <= 1 &&
        x2 >= 0 &&
        x2 <= 1
    );
}

function readEasings(group: object): Map<string, number[]> {
    const easings = new Map<string, number[]>();
    for (const [name, value] of readTokenValues(group, "motion.easing")) {
        if (!isCubicBezier(value)) {
            throw new Error(
                `motion.easing.${name} must be [x1, y1, x2, y2] with x1 and x2 between 0 and 1`,
            );
        }
        easings.set(name, value);
    }
    return easings;
}

function readMotion(tokens: object): Motion {
    const motion = readGroup(tokens, "motion", TOKENS_PATH);
    return {
        durations: readDurations(readGroup(motion, "duration", "motion")),
        easings: readEasings(readGroup(motion, "easing", "motion")),
    };
}

function cssBlock(
    selector: string,
    variables: Iterable<[string, string]>,
): string {
    const lines = [...variables].map(
        ([name, value]) => `    --${name}: ${value};`,
    );
    return `${selector} {\n${lines.join("\n")}\n}\n`;
}

function generateWebCss(
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

function generateDesktopTs(themes: Record<ThemeName, Theme>): string {
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
    const motion = readMotion(tokens);
    const outputs: [string, string][] = [
        [WEB_CSS_PATH, generateWebCss(themes, motion)],
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
