import { useMemo } from "react";

import { useProviders } from "./useProviders";

/** A model a session can use, with the provider that serves it. */
export interface ModelOption {
    providerId: string;
    providerName: string;
    model: string;
}

/** The models of every enabled provider, and the name of every provider by ID. */
export function useModelOptions(): {
    options: ModelOption[];
    providerNames: Map<string, string>;
} {
    const providers = useProviders();
    return useMemo(
        () => ({
            options: providers.list
                .filter((p) => p.enabled && p.models.length > 0)
                .flatMap((p) =>
                    p.models.map((model) => ({
                        providerId: p.id,
                        providerName: p.name,
                        model,
                    })),
                ),
            providerNames: new Map(providers.list.map((p) => [p.id, p.name])),
        }),
        [providers.list],
    );
}
