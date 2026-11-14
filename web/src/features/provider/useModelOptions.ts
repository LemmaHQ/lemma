import type { Provider } from "./store";
import { useProviders } from "./useProviders";

/** A model a session can use, with the provider that serves it. */
export interface ModelOption {
    providerId: string;
    providerName: string;
    model: string;
}

/** The models of every enabled provider and all configured providers. */
export function useModelOptions(): {
    options: ModelOption[];
    providers: Provider[];
} {
    const list = useProviders((s) => s.list);
    return {
        options: list
            .filter((p) => p.enabled && p.models.length > 0)
            .flatMap((p) =>
                p.models.map((model) => ({
                    providerId: p.id,
                    providerName: p.name,
                    model: model.id,
                })),
            ),
        providers: list,
    };
}
