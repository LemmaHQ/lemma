import { createHash } from "node:crypto";

export type Language = "en" | "zh" | "other";

export interface Translator {
    classify: (text: string) => Promise<Language>;
    translate: (text: string, target: "en" | "zh") => Promise<string>;
}

export interface ItemText {
    title?: string;
    body: string;
}

export interface TextPair {
    en: string;
    zh: string;
}

export interface StoredBody {
    en: string;
    zhTitle: string;
    zh: string;
    recorded: { title: TextPair; body: TextPair };
}

const EMPTY_PAIR: TextPair = { en: "", zh: "" };

const STORED_BODY =
    /^(?:(?<en>[\s\S]*?)\n\n---\n\n)?<details>\n<summary>🌐 <b>中文<\/b>(?:：(?<zhTitle>.*))?<\/summary>\n\n(?:(?<zh>[\s\S]*?)\n\n)?<\/details>\n\n<!-- lemma-translation title=(?<titleEn>[0-9a-f]{16}):(?<titleZh>[0-9a-f]{16}) body=(?<bodyEn>[0-9a-f]{16}):(?<bodyZh>[0-9a-f]{16}) -->$/u;

export async function syncItem(
    item: ItemText,
    translator: Translator,
): Promise<ItemText | undefined> {
    const stored = parseBody(item.body);
    const [title, body] = await Promise.all([
        item.title === undefined
            ? undefined
            : syncPair(
                  { en: item.title, zh: stored?.zhTitle ?? "" },
                  stored?.recorded.title,
                  translator,
              ),
        syncPair(
            { en: stored?.en ?? item.body, zh: stored?.zh ?? "" },
            stored?.recorded.body,
            translator,
        ),
    ]);
    const next: ItemText = { body: formatBody(title, body) };
    if (title !== undefined) {
        next.title = normalizeText(title.en);
    }
    return next.title === item.title && next.body === normalizeText(item.body)
        ? undefined
        : next;
}

export function parseBody(body: string): StoredBody | undefined {
    const groups = STORED_BODY.exec(normalizeText(body))?.groups;
    if (groups === undefined) return undefined;
    return {
        en: groups["en"] ?? "",
        zhTitle: (groups["zhTitle"] ?? "")
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">")
            .replaceAll("&amp;", "&"),
        zh: groups["zh"] ?? "",
        recorded: {
            title: { en: groups["titleEn"] ?? "", zh: groups["titleZh"] ?? "" },
            body: { en: groups["bodyEn"] ?? "", zh: groups["bodyZh"] ?? "" },
        },
    };
}

export function formatBody(
    title: TextPair | undefined,
    body: TextPair,
): string {
    const en = normalizeText(body.en);
    const zh = normalizeText(body.zh);
    const zhTitle = normalizeText(title?.zh ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    const [titleHashes, bodyHashes] = [title ?? EMPTY_PAIR, body].map(
        (pair) => `${fingerprint(pair.en)}:${fingerprint(pair.zh)}`,
    );
    return [
        ...(en === "" ? [] : [en, "", "---", ""]),
        "<details>",
        `<summary>🌐 <b>中文</b>${zhTitle === "" ? "" : `：${zhTitle}`}</summary>`,
        "",
        ...(zh === "" ? [] : [zh, ""]),
        "</details>",
        "",
        `<!-- lemma-translation title=${titleHashes} body=${bodyHashes} -->`,
    ].join("\n");
}

async function syncPair(
    current: TextPair,
    recorded: TextPair | undefined,
    translator: Translator,
): Promise<TextPair> {
    if (recorded === undefined || fingerprint(current.en) !== recorded.en) {
        return pairOfSource(current.en, translator);
    }
    if (fingerprint(current.zh) !== recorded.zh) {
        return {
            en: await translator.translate(current.zh, "en"),
            zh: current.zh,
        };
    }
    return current;
}

async function pairOfSource(
    source: string,
    translator: Translator,
): Promise<TextPair> {
    if (normalizeText(source) === "") return { en: "", zh: "" };
    const language = await translator.classify(source);
    if (language === "en") {
        return { en: source, zh: await translator.translate(source, "zh") };
    }
    if (language === "zh") {
        return { en: await translator.translate(source, "en"), zh: source };
    }
    const [en, zh] = await Promise.all([
        translator.translate(source, "en"),
        translator.translate(source, "zh"),
    ]);
    return { en, zh };
}

function normalizeText(text: string): string {
    return text.replaceAll("\r\n", "\n").trim();
}

function fingerprint(text: string): string {
    return createHash("sha256")
        .update(normalizeText(text))
        .digest("hex")
        .slice(0, 16);
}
