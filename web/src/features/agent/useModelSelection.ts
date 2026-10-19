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

function isModelSelection(value: unknown): value is ModelSelection {
    return (
        typeof value === "object" &&
        value !== null &&
        "providerId" in value &&
        typeof value.providerId === "string" &&
        value.providerId !== "" &&
        "model" in value &&
        typeof value.model === "string" &&
        value.model !== ""
    );
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
            if (raw === null) {
                return null;
            }
            const parsed: unknown = JSON.parse(raw);
            return isModelSelection(parsed) ? parsed : null;
        } catch {
            return null;
        }
    });

    const model = useMemo<ModelSelection | null>(() => {
        if (
            stored !== null &&
            options.some(
                (o) =>
                    o.providerId === stored.providerId &&
                    o.model === stored.model,
            )
        ) {
            return stored;
        }
        const first = options.at(0);
        return first === undefined
            ? null
            : { providerId: first.providerId, model: first.model };
    }, [stored, options]);

    const selectModel = (selection: ModelSelection) => {
        localStorage.setItem(MODEL_KEY, JSON.stringify(selection));
        setStored(selection);
    };

    return { model, options, selectModel };
}
