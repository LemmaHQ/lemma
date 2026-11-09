import type { MessageEntry, MessageText } from "./read-i18n.ts";

const KEYWORDS = new Set([
    "abstract",
    "as",
    "async",
    "await",
    "become",
    "box",
    "break",
    "const",
    "continue",
    "crate",
    "do",
    "dyn",
    "else",
    "enum",
    "extern",
    "false",
    "final",
    "fn",
    "for",
    "gen",
    "if",
    "impl",
    "in",
    "let",
    "loop",
    "macro",
    "match",
    "mod",
    "move",
    "mut",
    "override",
    "priv",
    "pub",
    "ref",
    "return",
    "self",
    "static",
    "struct",
    "super",
    "trait",
    "true",
    "try",
    "type",
    "typeof",
    "unsafe",
    "unsized",
    "use",
    "virtual",
    "where",
    "while",
    "yield",
]);
const RAW_IDENTIFIER_ERRORS = new Set(["crate", "self", "super"]);
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/u;

interface StringGroup {
    functions: string[];
    children: Map<string, StringGroup>;
}

export function renderDesktop(entries: MessageEntry[]): string {
    const selected = entries.filter((entry) =>
        entry.platforms.includes("desktop"),
    );
    checkNames(selected);
    const root: StringGroup = { functions: [], children: new Map() };
    for (const entry of selected) {
        let group = root;
        for (const part of entry.keyPath.slice(0, -1).map(snakeCase)) {
            let child = group.children.get(part);
            if (child === undefined) {
                child = { functions: [], children: new Map() };
                group.children.set(part, child);
            }
            group = child;
        }
        group.functions.push(renderFunction(entry));
    }
    return `${languageEnum()}${renderGroup(root)}`;
}

function languageEnum(): string {
    return `/// The interface language.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    /// English.
    En,
    /// Chinese.
    Zh,
}

`;
}

function renderGroup(group: StringGroup): string {
    const modules = [...group.children].map(renderModule);
    return [...group.functions, ...modules].join("\n");
}

function renderModule([name, group]: [string, StringGroup]): string {
    const language =
        group.functions.length > 0
            ? "    use crate::strings::Language;\n\n"
            : "";
    return `/// Interface strings for the ${name.replaceAll("_", " ")} group.
pub mod ${identifier(name)} {
${language}${indent(renderGroup(group))}
}
`;
}

function renderFunction(entry: MessageEntry): string {
    const name = identifier(snakeCase(entry.keyPath.at(-1) ?? ""));
    const params = Object.entries(entry.params).map(
        ([param, type]) =>
            `${identifier(snakeCase(param))}: ${type === "string" ? "&str" : "usize"}`,
    );
    const signature = [`language: Language`, ...params].join(", ");
    const result = params.length === 0 ? "&'static str" : "String";
    const body =
        entry.plural === undefined
            ? renderText(entry.en, entry.zh, entry.params)
            : renderPlural(entry);
    return `/// ${documentation(entry.en)}
#[must_use]
pub fn ${name}(${signature}) -> ${result} {
${indent(body)}
}
`;
}

function renderText(
    en: MessageText,
    zh: MessageText,
    params: Record<string, string>,
): string {
    if (typeof en !== "string" || typeof zh !== "string") {
        throw new TypeError(
            "desktop renderer received a plural without a selector",
        );
    }
    if (Object.keys(params).length === 0) {
        return `match language {
    Language::En => ${rustString(staticText(en))},
    Language::Zh => ${rustString(staticText(zh))},
}`;
    }
    return `match language {
    Language::En => ${formatCall(en, params)},
    Language::Zh => ${formatCall(zh, params)},
}`;
}

function renderPlural(entry: MessageEntry): string {
    if (typeof entry.en === "string" || typeof entry.zh === "string") {
        throw new TypeError(
            "desktop renderer received text with a plural selector",
        );
    }
    const count = identifier(snakeCase(entry.plural ?? ""));
    return `match language {
    Language::En if ${count} == 1 => ${formatCall(entry.en.one ?? entry.en.other ?? "", entry.params)},
    Language::En => ${formatCall(entry.en.other ?? "", entry.params)},
    Language::Zh => ${formatCall(entry.zh.other ?? "", entry.params)},
}`;
}

function formatCall(text: string, params: Record<string, string>): string {
    return `format!(${rustString(formatText(text, params))})`;
}

function formatText(text: string, params: Record<string, string>): string {
    let format = "";
    let index = 0;
    while (index < text.length) {
        const character = text[index] ?? "";
        const next = text[index + 1] ?? "";
        if (character === "\\" && (next === "{" || next === "}")) {
            format += next === "{" ? "{{" : "}}";
            index += 2;
            continue;
        }
        if (character === "{") {
            const end = text.indexOf("}", index + 1);
            const name = text.slice(index + 1, end);
            if (end > index && Object.hasOwn(params, name)) {
                format += `{${snakeCase(name)}}`;
                index = end + 1;
                continue;
            }
        }
        format +=
            character === "{" ? "{{" : character === "}" ? "}}" : character;
        index += 1;
    }
    return format;
}

function staticText(text: string): string {
    return text.replaceAll(/\\([{}])/gu, "$1");
}

function rustString(text: string): string {
    return JSON.stringify(text).replaceAll(
        /\\u([0-9a-f]{4})/giu,
        (_, digits: string) => `\\u{${digits}}`,
    );
}

function documentation(text: MessageText): string {
    const english =
        typeof text === "string" ? text : Object.values(text).join(" / ");
    return english.replaceAll(/\s+/gu, " ").trim();
}

function checkNames(entries: MessageEntry[]): void {
    const declarations = new Map<string, string>();
    for (const entry of entries) {
        const key = entry.keyPath.join(".");
        const names = entry.keyPath.map(snakeCase);
        for (const name of names) {
            validateIdentifier(name, key);
        }
        for (let length = 1; length < names.length; length += 1) {
            claim(declarations, names.slice(0, length), "module", key);
        }
        claim(declarations, names, "function", key);
        const params = new Set<string>(["language"]);
        for (const param of Object.keys(entry.params)) {
            const name = snakeCase(param);
            validateIdentifier(name, key);
            if (params.has(name)) {
                throw new Error(
                    `${key}: duplicate desktop parameter name ${name}`,
                );
            }
            params.add(name);
        }
    }
}

function claim(
    declarations: Map<string, string>,
    path: string[],
    kind: string,
    key: string,
): void {
    const name = path.join(".");
    const previous = declarations.get(name);
    if (previous !== undefined && (previous !== kind || kind === "function")) {
        throw new Error(`${key}: desktop name collision at ${name}`);
    }
    declarations.set(name, kind);
}

function validateIdentifier(name: string, key: string): void {
    if (!IDENTIFIER.test(name)) {
        throw new Error(`${key}: ${name} is not a valid desktop identifier`);
    }
    if (RAW_IDENTIFIER_ERRORS.has(name)) {
        throw new Error(`${key}: ${name} cannot be a raw desktop identifier`);
    }
}

function snakeCase(name: string): string {
    return name
        .replaceAll(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2")
        .replaceAll(/([a-z0-9])([A-Z])/gu, "$1_$2")
        .replaceAll("-", "_")
        .toLowerCase();
}

function identifier(name: string): string {
    return KEYWORDS.has(name) ? `r#${name}` : name;
}

function indent(text: string): string {
    return text
        .split("\n")
        .map((line) => (line === "" ? "" : `    ${line}`))
        .join("\n");
}
