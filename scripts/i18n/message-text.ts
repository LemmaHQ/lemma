import type { ParameterType } from "./message-entry.ts";

const PLACEHOLDER = /(?<!\\)\{([A-Za-z_][A-Za-z0-9_]*)\}/gu;
const PARAMETER_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;

export function placeholders(text: string): string[] {
    return [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "");
}

export function toWebText(text: string): string {
    return convertText(
        text,
        (name) => `{{${name}}}`,
        (character) => character,
    );
}

export function toAndroidText(
    text: string,
    params: Record<string, ParameterType>,
): string {
    const names = Object.keys(params);
    return convertText(
        text,
        (name) => {
            const conversion = params[name] === "number" ? "d" : "s";
            return `%${names.indexOf(name) + 1}$${conversion}`;
        },
        (character) => (character === "\\" ? "\\\\" : character),
    );
}

function convertText(
    text: string,
    renderPlaceholder: (name: string) => string,
    renderCharacter: (character: string) => string,
): string {
    let output = "";
    let index = 0;
    while (index < text.length) {
        const character = text[index] ?? "";
        const next = text[index + 1] ?? "";
        if (character === "\\" && (next === "{" || next === "}")) {
            output += next;
            index += 2;
            continue;
        }
        if (character === "{") {
            const end = text.indexOf("}", index + 1);
            const name = text.slice(index + 1, end);
            if (end > index && PARAMETER_NAME.test(name)) {
                output += renderPlaceholder(name);
                index = end + 1;
                continue;
            }
        }
        output += renderCharacter(character);
        index += 1;
    }
    return output;
}
