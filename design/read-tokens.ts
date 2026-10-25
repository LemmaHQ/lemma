export const THEMES = ["light", "dark"] as const;
export const WINDOW_ROLES = ["background", "sidebar", "foreground"] as const;

export type ThemeName = (typeof THEMES)[number];
export type Theme = Map<string, string>;

export interface Color {
    name: string[];
    hex: string;
}

export interface Motion {
    durations: Map<string, number>;
    easings: Map<string, number[]>;
}

const HEX_COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const PALETTE_REFERENCE = /^\{palette\.(.+)\}$/u;

export function readGroup(parent: object, key: string, label: string): object {
    const group: unknown = Reflect.get(parent, key);
    if (typeof group !== "object" || group === null) {
        throw new Error(`${label} must contain a ${key} group`);
    }
    return group;
}

function tokenKeys(group: object): string[] {
    return Object.keys(group).filter((key) => !key.startsWith("$"));
}

export function collectColors(
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

export function resolveTheme(
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

export function checkThemesMatch(light: Theme, dark: Theme): void {
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

export function readMotion(tokens: object, tokensPath: string): Motion {
    const motion = readGroup(tokens, "motion", tokensPath);
    return {
        durations: readDurations(readGroup(motion, "duration", "motion")),
        easings: readEasings(readGroup(motion, "easing", "motion")),
    };
}
