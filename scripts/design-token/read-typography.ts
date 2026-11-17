import { readAmount, readGroup, readTokenValues } from "./token-tree.ts";

/** A type style; sizes are in pixels and `fontWeight` is absent when the style keeps the inherited weight. */
export interface TextStyle {
    fontSize: number;
    lineHeight: number;
    fontWeight?: number;
}

const TEXT_STYLE_KEYS = ["fontSize", "lineHeight", "fontWeight"];

/** Reads the type styles; throws when a style lacks a pixel `fontSize` or `lineHeight`, has a weight outside 1–1000, or sets another property. */
export function readTypography(
    tokens: object,
    tokensPath: string,
): Map<string, TextStyle> {
    const group = readGroup(tokens, "typography", tokensPath);
    const styles = new Map<string, TextStyle>();
    for (const [name, value] of readTokenValues(group, "typography")) {
        const label = `typography.${name}`;
        if (typeof value !== "object" || value === null) {
            throw new Error(`${label} must be a typography object`);
        }
        const extra = Object.keys(value).filter(
            (key) => !TEXT_STYLE_KEYS.includes(key),
        );
        if (extra.length > 0) {
            throw new Error(
                `${label} supports only fontSize, lineHeight, and fontWeight; found ${extra.join(", ")}`,
            );
        }
        const style: TextStyle = {
            fontSize: readAmount(
                Reflect.get(value, "fontSize"),
                `${label}.fontSize`,
                "px",
            ),
            lineHeight: readAmount(
                Reflect.get(value, "lineHeight"),
                `${label}.lineHeight`,
                "px",
            ),
        };
        if ("fontWeight" in value) {
            const fontWeight: unknown = value.fontWeight;
            if (
                typeof fontWeight !== "number" ||
                !Number.isInteger(fontWeight) ||
                fontWeight < 1 ||
                fontWeight > 1000
            ) {
                throw new Error(
                    `${label}.fontWeight must be an integer from 1 to 1000`,
                );
            }
            style.fontWeight = fontWeight;
        }
        styles.set(name, style);
    }
    return styles;
}
