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
