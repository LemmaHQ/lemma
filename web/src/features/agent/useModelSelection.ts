import { useState } from "react";

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

/** The stored model choice while `options` offers it, else the first option. */
export function useModelSelection(options: ModelOption[]) {
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

    const storedOffered =
        stored !== null &&
        options.some(
            (o) =>
                o.providerId === stored.providerId && o.model === stored.model,
        );
    const first = options.at(0);
    const model: ModelSelection | null = storedOffered
        ? stored
        : first === undefined
          ? null
          : { providerId: first.providerId, model: first.model };

    const selectModel = (selection: ModelSelection) => {
        localStorage.setItem(MODEL_KEY, JSON.stringify(selection));
        setStored(selection);
    };

    return { model, selectModel };
}
