import { readAmounts, readGroup } from "./token-tree.ts";

export function readRadii(
    tokens: object,
    tokensPath: string,
): Map<string, number> {
    return readAmounts(readGroup(tokens, "radius", tokensPath), "radius", "px");
}
