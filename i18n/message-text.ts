const PLACEHOLDER = /(?<!\\)\{([A-Za-z_][A-Za-z0-9_]*)\}/gu;
const PARAMETER_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;

export function placeholders(text: string): string[] {
    return [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "");
}

export function toWebText(text: string): string {
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
                output += `{{${name}}}`;
                index = end + 1;
                continue;
            }
        }
        output += character;
        index += 1;
    }
    return output;
}
