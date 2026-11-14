import type { ApiFormat } from "./api-format";
import type { CustomProviderPatch } from "./store";

/** The editable connection settings of a custom provider. */
export interface ConnectionValues {
    apiKey: string;
    baseUrl: string;
    apiPath: string;
    modelsPath: string;
}

/** Example base URL and default endpoint paths of each API format. */
export const CONNECTION_PLACEHOLDERS: Record<
    ApiFormat,
    { baseUrl: string; apiPath: string; modelsPath: string }
> = {
    openai: {
        baseUrl: "https://api.example.com/v1",
        apiPath: "/chat/completions",
        modelsPath: "/models",
    },
    anthropic: {
        baseUrl: "https://api.example.com",
        apiPath: "/v1/messages",
        modelsPath: "/v1/models",
    },
    gemini: {
        baseUrl: "https://api.example.com",
        apiPath: "/v1beta/models/{model}:…",
        modelsPath: "/v1beta/models",
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
): CustomProviderPatch {
    const patch: CustomProviderPatch = {};
    const apiKey = values.apiKey.trim();
    if (apiKey !== saved.apiKey) {
        patch.apiKey = apiKey;
    }
    const baseUrl = values.baseUrl.trim();
    if (baseUrl !== saved.baseUrl) {
        patch.baseUrl = baseUrl;
    }
    const apiPath = values.apiPath.trim();
    if (apiPath !== saved.apiPath) {
        patch.apiPath = apiPath;
    }
    const modelsPath = values.modelsPath.trim();
    if (modelsPath !== saved.modelsPath) {
        patch.modelsPath = modelsPath;
    }
    return patch;
}
