import { readAmounts, readGroup, readTokenValues } from "./token-tree.ts";

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
