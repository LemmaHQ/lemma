import { expect, it } from "vitest";

import en from "./locales/en.json";
import zh from "./locales/zh.json";

type Messages = { [key: string]: string | Messages };

function keys(messages: Messages, prefix = ""): string[] {
    return Object.entries(messages)
        .flatMap(([key, value]) =>
            typeof value === "string"
                ? [prefix + key]
                : keys(value, `${prefix}${key}.`),
        )
        .sort();
}

it("gives every English message a Chinese counterpart", () => {
    expect(keys(zh)).toEqual(keys(en));
});
