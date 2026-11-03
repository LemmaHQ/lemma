import { create } from "zustand";

import {
    ProviderKind as ProviderKindProto,
    type Provider as ProviderProto,
} from "@/gen/lemma/v1/provider_pb";
import { providerClient } from "@/rpc/clients";

/** The API protocol a provider speaks. */
export type ProviderKind = "openai" | "anthropic" | "gemini";

/** A configured provider as the settings pages and the model picker read it. */
export interface Provider {
    id: string;
    kind: ProviderKind;
    identifier: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    apiPath: string;
    models: string[];
    enabled: boolean;
}

export interface ProviderPatch {
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    enabled?: boolean;
    models?: string[];
    apiPath?: string;
    modelsPath?: string;
}

export interface NewProvider {
    kind: ProviderKind;
    identifier: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    apiPath?: string;
    modelsPath?: string;
}

/** Checks a stored provider by `id`, or the inline connection when `id` is absent. */
export interface CheckRequest {
    id?: string;
    kind?: ProviderKind;
    baseUrl?: string;
    apiKey?: string;
    apiPath?: string;
    model: string;
}

interface ProviderState {
    list: Provider[];
    loaded: boolean;
    refresh: () => Promise<void>;
    create: (input: NewProvider) => Promise<Provider>;
    update: (id: string, patch: ProviderPatch) => Promise<void>;
    remove: (id: string) => Promise<void>;
    fetchModels: (req: {
        id?: string;
        kind?: ProviderKind;
        baseUrl?: string;
        apiKey?: string;
        modelsPath?: string;
    }) => Promise<string[]>;
    checkProvider: (req: CheckRequest) => Promise<string>;
}

const KIND_PROTOS: Record<ProviderKind, ProviderKindProto> = {
    openai: ProviderKindProto.OPENAI,
    anthropic: ProviderKindProto.ANTHROPIC,
    gemini: ProviderKindProto.GEMINI,
};

export const useProviderStore = create<ProviderState>()((set) => ({
    list: [],
    loaded: false,

    refresh: async () => {
        const res = await providerClient.listProviders({});
        set({ list: res.providers.map(toProvider), loaded: true });
    },

    create: async (input) => {
        const res = await providerClient.createProvider({
            ...input,
            kind: toKindProto(input.kind),
        });
        if (res.provider === undefined) {
            throw new Error("no provider in response");
        }
        const provider = toProvider(res.provider);
        set((s) => ({ list: [...s.list, provider] }));
        return provider;
    },

    update: async (id, patch) => {
        const res = await providerClient.updateProvider({
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
        if (res.provider === undefined) {
            return;
        }
        const provider = toProvider(res.provider);
        set((s) => ({
            list: s.list.map((p) => (p.id === id ? provider : p)),
        }));
    },

    remove: async (id) => {
        await providerClient.deleteProvider({ id });
        set((s) => ({ list: s.list.filter((p) => p.id !== id) }));
    },

    fetchModels: async (req) => {
        const res = await providerClient.fetchModels({
            ...req,
            kind: toKindProto(req.kind),
        });
        return res.models;
    },

    checkProvider: async (req) => {
        const res = await providerClient.checkProvider({
            ...req,
            kind: toKindProto(req.kind),
        });
        return res.error;
    },
}));

function toKindProto(kind: ProviderKind | undefined): ProviderKindProto {
    return kind === undefined
        ? ProviderKindProto.UNSPECIFIED
        : KIND_PROTOS[kind];
}

function toProvider(p: ProviderProto): Provider {
    return {
        id: p.id,
        kind: toKind(p.kind),
        identifier: p.identifier,
        name: p.name,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        apiPath: p.apiPath,
        models: p.models,
        enabled: p.enabled,
    };
}

function toKind(kind: ProviderKindProto): ProviderKind {
    switch (kind) {
        case ProviderKindProto.ANTHROPIC:
            return "anthropic";
        case ProviderKindProto.GEMINI:
            return "gemini";
        default:
            return "openai";
    }
}
