import { create } from "zustand";

import {
    ApiFormat as ApiFormatProto,
    type Provider as ProviderProto,
} from "@/gen/lemma/v1/provider_pb";
import { providerClient } from "@/rpc/clients";

import type { ApiFormat } from "./api-format";

export interface Model {
    id: string;
    toolCalling: boolean;
}

interface ProviderBase {
    id: string;
    apiKey: string;
    enabled: boolean;
    identifier: string;
    name: string;
    models: Model[];
}

export interface CustomProvider extends ProviderBase {
    source: "custom";
    apiFormat: ApiFormat;
    baseUrl: string;
    apiPath: string;
    modelsPath: string;
}

export interface PredefinedProvider extends ProviderBase {
    source: "predefined";
    apiFormats: ApiFormat[];
    defaultApiFormat: ApiFormat;
}

/** A configured provider as the settings pages and the model picker read it. */
export type Provider = CustomProvider | PredefinedProvider;

export interface CustomProviderPatch {
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    enabled?: boolean;
    models?: Model[];
    apiPath?: string;
    modelsPath?: string;
}

export interface PredefinedProviderPatch {
    apiKey?: string;
    enabled?: boolean;
    defaultApiFormat?: ApiFormat;
}

interface NewCustomProvider {
    apiFormat: ApiFormat;
    identifier: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    models: Model[];
    apiPath?: string;
    modelsPath?: string;
}

export interface ProviderState {
    list: Provider[];
    loaded: boolean;
    refresh: () => Promise<void>;
    create: (input: NewCustomProvider) => Promise<Provider>;
    updateCustom: (id: string, patch: CustomProviderPatch) => Promise<void>;
    updatePredefined: (
        id: string,
        patch: PredefinedProviderPatch,
    ) => Promise<void>;
    remove: (id: string) => Promise<void>;
    fetchModels: (id: string) => Promise<string[]>;
    checkProvider: (id: string, model: string) => Promise<string>;
}

const API_FORMAT_PROTOS: Record<ApiFormat, ApiFormatProto> = {
    openai: ApiFormatProto.OPENAI,
    anthropic: ApiFormatProto.ANTHROPIC,
    gemini: ApiFormatProto.GEMINI,
};

export const useProviderStore = create<ProviderState>()((set) => ({
    list: [],
    loaded: false,

    refresh: async () => {
        const res = await providerClient.listProviders({});
        set({ list: res.providers.map(toProvider), loaded: true });
    },

    create: async (input) => {
        const res = await providerClient.createCustomProvider({
            ...input,
            apiFormat: API_FORMAT_PROTOS[input.apiFormat],
        });
        if (res.provider === undefined) {
            throw new Error("no provider in response");
        }
        const provider = toProvider(res.provider);
        set((s) => ({ list: [...s.list, provider] }));
        return provider;
    },

    updateCustom: async (id, patch) => {
        const res = await providerClient.updateCustomProvider({
            id,
            name: patch.name,
            baseUrl: patch.baseUrl,
            apiKey: patch.apiKey,
            enabled: patch.enabled,
            models:
                patch.models === undefined
                    ? undefined
                    : { models: patch.models },
            apiPath: patch.apiPath,
            modelsPath: patch.modelsPath,
        });
        replaceProvider(set, id, res.provider);
    },

    updatePredefined: async (id, patch) => {
        const res = await providerClient.updatePredefinedProvider({
            id,
            apiKey: patch.apiKey,
            enabled: patch.enabled,
            defaultApiFormat:
                patch.defaultApiFormat === undefined
                    ? undefined
                    : API_FORMAT_PROTOS[patch.defaultApiFormat],
        });
        replaceProvider(set, id, res.provider);
    },

    remove: async (id) => {
        await providerClient.deleteCustomProvider({ id });
        set((s) => ({ list: s.list.filter((p) => p.id !== id) }));
    },

    fetchModels: async (id) => {
        const res = await providerClient.fetchModels({ id });
        return res.models;
    },

    checkProvider: async (id, model) => {
        const res = await providerClient.checkProvider({ id, model });
        return res.error;
    },
}));

function replaceProvider(
    set: (updater: (state: ProviderState) => Partial<ProviderState>) => void,
    id: string,
    proto: ProviderProto | undefined,
): void {
    if (proto === undefined) {
        return;
    }
    const provider = toProvider(proto);
    set((s) => ({
        list: s.list.map((p) => (p.id === id ? provider : p)),
    }));
}

function toProvider(p: ProviderProto): Provider {
    const base = {
        id: p.id,
        apiKey: p.apiKey,
        enabled: p.enabled,
    };
    if (p.source.case === "predefined") {
        const predefined = p.source.value;
        return {
            ...base,
            source: "predefined",
            identifier: predefined.identifier,
            name: predefined.name,
            apiFormats: predefined.apiFormats.map(toApiFormat),
            defaultApiFormat: toApiFormat(predefined.defaultApiFormat),
            models: predefined.models.map(({ id, toolCalling }) => ({
                id,
                toolCalling,
            })),
        };
    }
    if (p.source.case === "custom") {
        const custom = p.source.value;
        return {
            ...base,
            source: "custom",
            identifier: custom.identifier,
            name: custom.name,
            apiFormat: toApiFormat(custom.apiFormat),
            baseUrl: custom.baseUrl,
            apiPath: custom.apiPath,
            modelsPath: custom.modelsPath,
            models: custom.models.map(({ id, toolCalling }) => ({
                id,
                toolCalling,
            })),
        };
    }
    throw new Error("no source in provider response");
}

function toApiFormat(format: ApiFormatProto): ApiFormat {
    switch (format) {
        case ApiFormatProto.ANTHROPIC:
            return "anthropic";
        case ApiFormatProto.GEMINI:
            return "gemini";
        default:
            return "openai";
    }
}
