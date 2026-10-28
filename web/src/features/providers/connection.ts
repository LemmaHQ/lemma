import { ProviderKind } from "@/gen/lemma/v1/provider_pb";

import type { ProviderPatch } from "./store";

/** The editable connection settings of a provider. */
export interface ConnectionValues {
    apiKey: string;
    baseUrl: string;
    apiPath: string;
}

const OPENAI_PLACEHOLDERS = {
    baseUrl: "https://api.example.com/v1",
    apiPath: "/chat/completions",
};

/** Example base URL and default request path of each provider kind. */
export const CONNECTION_PLACEHOLDERS: Record<
    ProviderKind,
    { baseUrl: string; apiPath: string }
> = {
    [ProviderKind.UNSPECIFIED]: OPENAI_PLACEHOLDERS,
    [ProviderKind.OPENAI]: OPENAI_PLACEHOLDERS,
    [ProviderKind.ANTHROPIC]: {
        baseUrl: "https://api.example.com",
        apiPath: "/v1/messages",
    },
    [ProviderKind.GEMINI]: {
        baseUrl: "https://api.example.com",
        apiPath: "/v1beta/models/{model}:…",
    },
};

/** Whether a base URL names an HTTP or HTTPS endpoint. */
export function isBaseUrlValid(baseUrl: string): boolean {
    return /^https?:\/\/\S+$/u.test(baseUrl.trim());
}

/** The trimmed fields of `values` that differ from `saved`. */
export function connectionPatch(
    values: ConnectionValues,
    saved: ConnectionValues,
): ProviderPatch {
    const patch: ProviderPatch = {};
    if (values.apiKey.trim() !== saved.apiKey) {
        patch.apiKey = values.apiKey.trim();
    }
    if (values.baseUrl.trim() !== saved.baseUrl) {
        patch.baseUrl = values.baseUrl.trim();
    }
    if (values.apiPath.trim() !== saved.apiPath) {
        patch.apiPath = values.apiPath.trim();
    }
    return patch;
}
