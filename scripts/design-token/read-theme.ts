import { readGroup, tokenKeys } from "./token-tree.ts";

export const THEMES = ["light", "dark"] as const;
export const WINDOW_ROLES = ["background", "sidebar", "foreground"] as const;

export type ThemeName = (typeof THEMES)[number];
export type Theme = Map<string, string>;

export interface Color {
    name: string[];
    hex: string;
}

const HEX_COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const PALETTE_REFERENCE = /^\{palette\.(.+)\}$/u;

/** Reads the palette and resolves both themes' roles to hex colors; throws when a role misses the palette or the themes define different roles. */
export function readThemes(
    tokens: object,
    tokensPath: string,
): { colors: Color[]; themes: Record<ThemeName, Theme> } {
    const colors = collectColors(
        readGroup(tokens, "palette", tokensPath),
        [],
        [],
    );
    const palette = new Map(
        colors.map(({ name, hex }) => [name.join("."), hex]),
    );
    const themes = {
        light: resolveTheme(readGroup(tokens, "light", tokensPath), "light", palette),
        dark: resolveTheme(readGroup(tokens, "dark", tokensPath), "dark", palette),
    };
    checkThemesMatch(themes.light, themes.dark);
    return { colors, themes };
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
