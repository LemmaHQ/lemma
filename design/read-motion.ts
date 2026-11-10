import { readGroup, readTokenValues } from "./token-tree.ts";

export interface Motion {
    durations: Map<string, number>;
    easings: Map<string, number[]>;
}

export function readMotion(tokens: object, tokensPath: string): Motion {
    const motion = readGroup(tokens, "motion", tokensPath);
    return {
        durations: readAmounts(
            readGroup(motion, "duration", "motion"),
            "motion.duration",
            "ms",
        ),
        easings: readEasings(readGroup(motion, "easing", "motion")),
    };
}

export function readRadii(
    tokens: object,
    tokensPath: string,
): Map<string, number> {
    return readAmounts(readGroup(tokens, "radius", tokensPath), "radius", "px");
}

function readAmounts(
    group: object,
    label: string,
    unit: string,
): Map<string, number> {
    const amounts = new Map<string, number>();
    for (const [name, value] of readTokenValues(group, label)) {
        const isObject = typeof value === "object" && value !== null;
        const amount: unknown = isObject
            ? Reflect.get(value, "value")
            : undefined;
        const valueUnit: unknown = isObject
            ? Reflect.get(value, "unit")
            : undefined;
        if (typeof amount !== "number" || amount < 0 || valueUnit !== unit) {
            throw new Error(
                `${label}.${name} must be { "value": <non-negative number>, "unit": "${unit}" }`,
            );
        }
        amounts.set(name, amount);
    }
    return amounts;
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
