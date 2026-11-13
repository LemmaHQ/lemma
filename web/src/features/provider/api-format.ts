import type { ParseKeys } from "i18next";

export const API_FORMATS = ["openai", "anthropic", "gemini"] as const;

export type ApiFormat = (typeof API_FORMATS)[number];

export const API_FORMAT_I18N_KEYS: Record<ApiFormat, ParseKeys> = {
    openai: "provider.apiFormatOpenai",
    anthropic: "provider.apiFormatAnthropic",
    gemini: "provider.apiFormatGemini",
};
