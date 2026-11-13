import type { ApiFormat } from "./api-format";
import type { CustomProviderPatch } from "./store";

/** The editable connection settings of a provider. */
export interface ConnectionValues {
    apiKey: string;
    baseUrl: string;
    apiPath: string;
}

/** Example base URL and default request path of each API format. */
export const CONNECTION_PLACEHOLDERS: Record<
    ApiFormat,
    { baseUrl: string; apiPath: string }
> = {
    openai: {
        baseUrl: "https://api.example.com/v1",
        apiPath: "/chat/completions",
    },
    anthropic: {
        baseUrl: "https://api.example.com",
        apiPath: "/v1/messages",
    },
    gemini: {
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
    saved: Pick<ConnectionValues, "baseUrl" | "apiPath">,
): CustomProviderPatch {
    const patch: CustomProviderPatch = {};
    const apiKey = values.apiKey.trim();
    if (apiKey !== "") {
        patch.apiKey = apiKey;
    }
    if (values.baseUrl.trim() !== saved.baseUrl) {
        patch.baseUrl = values.baseUrl.trim();
    }
    if (values.apiPath.trim() !== saved.apiPath) {
        patch.apiPath = values.apiPath.trim();
    }
    return patch;
}
