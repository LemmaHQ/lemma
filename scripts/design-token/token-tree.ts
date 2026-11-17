import fs from "node:fs";

export function readTokenFile(tokensPath: string): object {
    const tokens: unknown = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
    if (typeof tokens !== "object" || tokens === null) {
        throw new Error(`${tokensPath} must contain a token tree`);
    }
    return tokens;
}

export function readGroup(parent: object, key: string, label: string): object {
    const group: unknown = Reflect.get(parent, key);
    if (typeof group !== "object" || group === null) {
        throw new Error(`${label} must contain a ${key} group`);
    }
    return group;
}

export function tokenKeys(group: object): string[] {
    return Object.keys(group).filter((key) => !key.startsWith("$"));
}

export function readTokenValues(
    group: object,
    label: string,
): Map<string, unknown> {
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

/** Reads a `{ "value": <non-negative number>, "unit": <unit> }` dimension or duration; throws naming `label` otherwise. */
export function readAmount(
    value: unknown,
    label: string,
    unit: string,
): number {
    const isObject = typeof value === "object" && value !== null;
    const amount: unknown = isObject
        ? Reflect.get(value, "value")
        : undefined;
    const valueUnit: unknown = isObject
        ? Reflect.get(value, "unit")
        : undefined;
    if (typeof amount !== "number" || amount < 0 || valueUnit !== unit) {
        throw new Error(
            `${label} must be { "value": <non-negative number>, "unit": "${unit}" }`,
        );
    }
    return amount;
}

export function readAmounts(
    group: object,
    label: string,
    unit: string,
): Map<string, number> {
    const amounts = new Map<string, number>();
    for (const [name, value] of readTokenValues(group, label)) {
        amounts.set(name, readAmount(value, `${label}.${name}`, unit));
    }
    return amounts;
}
