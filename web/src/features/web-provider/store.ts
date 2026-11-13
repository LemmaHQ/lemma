import { create } from "zustand";

import {
    SetWebProviderOrderRequest_Function as WebFunctionProto,
    WebProvider_Kind as WebProviderKindProto,
    type WebProvider as WebProviderProto,
} from "@/gen/lemma/v1/provider_pb";
import { providerClient } from "@/rpc/clients";

export type WebProviderKind = "native" | "exa" | "deepseek";
export type WebFunction = "search" | "fetch";

export interface WebProvider {
    id: string;
    kind: WebProviderKind;
    name: string;
    enabled: boolean;
    hasKey: boolean;
    searchRank: number;
    fetchRank: number;
}

export interface WebProviderPatch {
    apiKey?: string;
    enabled?: boolean;
}

interface WebProviderState {
    list: WebProvider[];
    loaded: boolean;
    refresh: () => Promise<void>;
    update: (id: string, patch: WebProviderPatch) => Promise<void>;
    setOrder: (fn: WebFunction, ids: string[]) => Promise<void>;
}

export const useWebProviderStore = create<WebProviderState>()((set) => ({
    list: [],
    loaded: false,

    refresh: async () => {
        const res = await providerClient.listWebProviders({});
        set({ list: res.providers.map(toWebProvider), loaded: true });
    },

    update: async (id, patch) => {
        const res = await providerClient.updateWebProvider({ id, ...patch });
        if (res.provider === undefined) {
            return;
        }
        const provider = toWebProvider(res.provider);
        set((state) => ({
            list: state.list.map((item) => (item.id === id ? provider : item)),
        }));
    },

    setOrder: async (fn, ids) => {
        const res = await providerClient.setWebProviderOrder({
            function:
                fn === "search"
                    ? WebFunctionProto.SEARCH
                    : WebFunctionProto.FETCH,
            ids,
        });
        set({ list: res.providers.map(toWebProvider) });
    },
}));

function toWebProvider(provider: WebProviderProto): WebProvider {
    return {
        id: provider.id,
        kind: toWebProviderKind(provider.kind),
        name: provider.name,
        enabled: provider.enabled,
        hasKey: provider.hasKey,
        searchRank: provider.searchRank,
        fetchRank: provider.fetchRank,
    };
}

function toWebProviderKind(kind: WebProviderKindProto): WebProviderKind {
    switch (kind) {
        case WebProviderKindProto.NATIVE:
            return "native";
        case WebProviderKindProto.EXA:
            return "exa";
        case WebProviderKindProto.DEEPSEEK:
            return "deepseek";
        default:
            throw new Error("unknown web provider kind");
    }
}
