import type { UiToolCall } from "./ui-message";

/** A single web search hit rendered inside a web detail payload. */
export interface WebHit {
    title: string;
    url: string;
    snippet: string;
}

/** Structured body payload rendered when inspecting a timeline step. */
export type DetailPayload =
    | { kind: "prose"; text: string }
    | { kind: "code"; code: string; language?: string | undefined }
    | { kind: "web"; note?: string | undefined; hits: WebHit[] }
    | { kind: "output"; text: string };

const EXT_LANGUAGE: Readonly<Record<string, string>> = {
    ts: "ts",
    tsx: "tsx",
    js: "js",
    jsx: "jsx",
    rs: "rust",
    py: "python",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    sh: "bash",
    proto: "protobuf",
    kt: "kotlin",
    kts: "kotlin",
    sql: "sql",
};

/** Parses a JSON string into an unknown value, returning undefined on invalid JSON. */
function parseJsonValue(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}

/** Parses a JSON string into a plain key-value object, returning null otherwise. */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
    const parsed = parseJsonValue(raw);
    if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
    ) {
        return null;
    }
    return Object.fromEntries(Object.entries(parsed));
}

/** Returns the value when it is a non-empty string. */
export function nonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value !== "" ? value : undefined;
}

/** Terminal path segment of `path`, or `path` itself when no separator is present. */
export function lastPathSegment(path: string): string {
    return path.split(/[\\/]/u).findLast((part) => part !== "") ?? path;
}
/** Formats a completed tool call's output and provider metadata into a DetailPayload. */
export function parseToolOutput(
    call: UiToolCall,
    argument: string,
): { via?: string | undefined; detail: DetailPayload } {
    if (call.isError || call.state === "running") {
        return { detail: { kind: "output", text: call.output } };
    }
    switch (call.name) {
        case "read_file": {
            const parsed = parseJsonValue(call.output);
            const code = typeof parsed === "string" ? parsed : call.output;
            return {
                detail: {
                    kind: "code",
                    code,
                    language: languageFromPath(argument),
                },
            };
        }
        case "write_file": {
            const args = parseJsonObject(call.arguments);
            if (args !== null && typeof args.content === "string") {
                return {
                    detail: {
                        kind: "code",
                        code: args.content,
                        language: languageFromPath(argument),
                    },
                };
            }
            return { detail: { kind: "output", text: call.output } };
        }
        case "web_search":
            return parseWebSearch(call.output);
        case "web_fetch":
            return parseWebFetch(call.output);
        case "bash":
            return {
                detail: { kind: "output", text: formatBashOutput(call.output) },
            };
        default:
            return { detail: { kind: "output", text: call.output } };
    }
}

function parseWebSearch(raw: string): {
    via?: string | undefined;
    detail: DetailPayload;
} {
    const obj = parseJsonObject(raw);
    if (obj === null || !Array.isArray(obj.results)) {
        return { detail: { kind: "output", text: raw } };
    }
    const hits: WebHit[] = [];
    for (const item of Array.from<unknown>(obj.results)) {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
            continue;
        }
        const entry = Object.fromEntries(Object.entries(item));
        const url = typeof entry.url === "string" ? entry.url : "";
        const title = nonEmptyString(entry.title) ?? url;
        const snippet =
            nonEmptyString(entry.snippet) ??
            nonEmptyString(entry.summary) ??
            (typeof entry.text === "string" ? entry.text : "");
        hits.push({ title, url, snippet });
    }
    return {
        via: nonEmptyString(obj.provider),
        detail: { kind: "web", note: nonEmptyString(obj.note), hits },
    };
}

function parseWebFetch(raw: string): {
    via?: string | undefined;
    detail: DetailPayload;
} {
    const obj = parseJsonObject(raw);
    if (obj === null) {
        return { detail: { kind: "output", text: raw } };
    }
    const title = nonEmptyString(obj.title);
    const body =
        nonEmptyString(obj.content) ??
        (typeof obj.text === "string" ? obj.text : undefined);
    const text =
        title !== undefined && body !== undefined
            ? `${title}\n\n${body}`
            : (body ?? title ?? raw);
    return {
        via: nonEmptyString(obj.provider),
        detail: { kind: "output", text },
    };
}

function formatBashOutput(raw: string): string {
    const obj = parseJsonObject(raw);
    if (obj === null) {
        return raw;
    }
    const stopped = nonEmptyString(obj.stopped);
    const parts = [
        typeof obj.stdout === "string" ? obj.stdout : "",
        typeof obj.stderr === "string" ? obj.stderr : "",
        stopped === undefined ? "" : `[${stopped}]`,
    ].filter((part) => part !== "");
    if (parts.length > 0) {
        return parts.join("\n");
    }
    return typeof obj.exit_code === "number" && obj.exit_code !== 0
        ? `exit ${String(obj.exit_code)}`
        : "";
}

function languageFromPath(path: string): string | undefined {
    const base = lastPathSegment(path);
    const dot = base.lastIndexOf(".");
    return dot < 0
        ? undefined
        : EXT_LANGUAGE[base.slice(dot + 1).toLowerCase()];
}
