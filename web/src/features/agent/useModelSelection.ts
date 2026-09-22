import { useMemo, useState } from "react";

import { useProviders } from "@/features/providers/useProviders";

const MODEL_KEY = "lemma.model";

export interface ModelSelection {
    providerId: string;
    model: string;
}

export interface ModelOption extends ModelSelection {
    providerName: string;
}

export function useModelSelection() {
    const providers = useProviders();

    const options = useMemo<ModelOption[]>(
        () =>
            providers.list
                .filter((p) => p.enabled && p.models.length > 0)
                .flatMap((p) =>
                    p.models.map((model) => ({
                        providerId: p.id,
                        providerName: p.name,
                        model,
                    })),
                ),
        [providers.list],
    );

    const [stored, setStored] = useState<ModelSelection | null>(() => {
        try {
            const raw = localStorage.getItem(MODEL_KEY);
            const parsed = raw ? (JSON.parse(raw) as ModelSelection) : null;
            return parsed?.providerId && parsed?.model ? parsed : null;
        } catch {
            return null;
        }
    });

    const model = useMemo<ModelSelection | null>(() => {
        if (
            stored &&
            options.some(
                (o) =>
                    o.providerId === stored.providerId &&
                    o.model === stored.model,
            )
        ) {
            return stored;
        }
        const first = options[0];
        return first
            ? { providerId: first.providerId, model: first.model }
            : null;
    }, [stored, options]);

    const selectModel = (selection: ModelSelection) => {
        localStorage.setItem(MODEL_KEY, JSON.stringify(selection));
        setStored(selection);
    };

    return { model, options, selectModel };
}
