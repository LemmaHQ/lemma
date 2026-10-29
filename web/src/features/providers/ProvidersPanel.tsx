import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ScrollArea } from "@lemma/ui/components/scroll-area";
import { errorText } from "@/data/rpc/errors";

import {
    NewProviderForm,
    type NewProviderData,
} from "./components/NewProviderForm";
import { ProviderDetail } from "./components/ProviderDetail";
import { ProviderListPane } from "./components/ProviderListPane";
import type { ProviderPatch } from "./store";
import { useProviders } from "./useProviders";

export function ProvidersPanel() {
    const { t } = useTranslation();
    const store = useProviders();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const effectiveSelectedId =
        selectedId ?? (store.loaded ? (store.list[0]?.id ?? null) : null);
    const selected =
        store.list.find((p) => p.id === effectiveSelectedId) ?? null;

    const handleSaveNew = async (data: NewProviderData) => {
        const provider = await store.create({
            kind: data.kind,
            identifier: data.identifier,
            name: data.name,
            baseUrl: data.baseUrl,
            apiKey: data.apiKey,
            apiPath: data.apiPath,
            models: [],
        });
        setSelectedId(provider.id);
        setCreating(false);
    };

    const handleDelete = async (id: string) => {
        await store.remove(id);
        setSelectedId(null);
    };

    const applyPatch = async (id: string, patch: ProviderPatch) => {
        try {
            await store.update(id, patch);
        } catch (e) {
            toast.error(errorText(e, t));
        }
    };

    return (
        <div className="flex min-h-0 flex-1">
            <ProviderListPane
                providers={store.list}
                loaded={store.loaded}
                selectedId={creating ? null : effectiveSelectedId}
                onSelect={(id) => {
                    setCreating(false);
                    setSelectedId(id);
                }}
                onCreate={() => setCreating(true)}
            />
            <ScrollArea className="min-w-0 flex-1">
                {creating ? (
                    <NewProviderForm
                        onSave={handleSaveNew}
                        onCancel={() => setCreating(false)}
                    />
                ) : selected === null ? (
                    store.loaded && (
                        <div className="grid h-full place-items-center text-sm text-muted-foreground">
                            {t("providers.emptyList")}
                        </div>
                    )
                ) : (
                    <ProviderDetail
                        key={selected.id}
                        provider={selected}
                        onSave={(patch) => store.update(selected.id, patch)}
                        onToggleEnabled={(enabled) =>
                            void applyPatch(selected.id, { enabled })
                        }
                        onModelsChange={(models) =>
                            void applyPatch(selected.id, { models })
                        }
                        onFetchModels={() =>
                            store.fetchModels({ id: selected.id })
                        }
                        onCheck={(req) => store.checkProvider(req)}
                        onDelete={() => handleDelete(selected.id)}
                    />
                )}
            </ScrollArea>
        </div>
    );
}
