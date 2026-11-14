import {
    Button,
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
    SettingsPage,
    toast,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import type { Provider } from "../store";
import { useProviders } from "../useProviders";
import { NewProviderForm, type NewProviderData } from "./NewProviderForm";
import { PredefinedProviderDetail } from "./PredefinedProviderDetail";
import { ProviderDetail } from "./ProviderDetail";
import { ProviderListPane } from "./ProviderListPane";

type PanelView =
    | { kind: "loading" }
    | { kind: "creating" }
    | { kind: "empty" }
    | { kind: "detail"; provider: Provider };

function resolvePanelView(
    creating: boolean,
    loaded: boolean,
    selected: Provider | null,
): PanelView {
    if (creating) {
        return { kind: "creating" };
    }
    if (!loaded) {
        return { kind: "loading" };
    }
    if (selected === null) {
        return { kind: "empty" };
    }
    return { kind: "detail", provider: selected };
}

export function ProviderPanel() {
    const { t } = useTranslation();
    const store = useProviders();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const effectiveSelectedId =
        selectedId ?? (store.loaded ? (store.list[0]?.id ?? null) : null);
    const selected =
        store.list.find((p) => p.id === effectiveSelectedId) ?? null;
    const view = resolvePanelView(creating, store.loaded, selected);

    const handleSaveNew = async (data: NewProviderData) => {
        const provider = await store.create({
            apiFormat: data.apiFormat,
            identifier: data.identifier,
            name: data.name,
            baseUrl: data.baseUrl,
            apiKey: data.apiKey,
            apiPath: data.apiPath,
            modelsPath: data.modelsPath,
            models: [],
        });
        setSelectedId(provider.id);
        setCreating(false);
    };

    const handleDelete = async (id: string) => {
        await store.remove(id);
        setSelectedId(null);
    };

    const applyPatch = async (update: () => Promise<void>) => {
        try {
            await update();
        } catch (e) {
            toast.error(errorText(e, t));
        }
    };

    const listPane = (
        <ProviderListPane
            providers={store.list}
            loaded={store.loaded}
            creating={creating}
            selectedId={creating ? null : effectiveSelectedId}
            onSelect={(id) => {
                setCreating(false);
                setSelectedId(id);
            }}
            onCreate={() => setCreating(true)}
        />
    );

    if (view.kind === "creating") {
        return (
            <NewProviderForm
                index={listPane}
                onSave={handleSaveNew}
                onCancel={() => setCreating(false)}
            />
        );
    }

    if (view.kind === "detail") {
        const { provider } = view;
        if (provider.source === "predefined") {
            return (
                <PredefinedProviderDetail
                    key={provider.id}
                    index={listPane}
                    provider={provider}
                    onSave={(patch) =>
                        store.updatePredefined(provider.id, patch)
                    }
                    onToggleEnabled={(enabled) =>
                        void applyPatch(() =>
                            store.updatePredefined(provider.id, { enabled }),
                        )
                    }
                    onDefaultApiFormatChange={(defaultApiFormat) =>
                        void applyPatch(() =>
                            store.updatePredefined(provider.id, {
                                defaultApiFormat,
                            }),
                        )
                    }
                    onCheck={(model) => store.checkProvider(provider.id, model)}
                />
            );
        }
        return (
            <ProviderDetail
                key={provider.id}
                index={listPane}
                provider={provider}
                onSave={(patch) => store.updateCustom(provider.id, patch)}
                onToggleEnabled={(enabled) =>
                    void applyPatch(() =>
                        store.updateCustom(provider.id, { enabled }),
                    )
                }
                onModelsChange={(models) =>
                    void applyPatch(() =>
                        store.updateCustom(provider.id, { models }),
                    )
                }
                onFetchModels={() => store.fetchModels(provider.id)}
                onCheck={(model) => store.checkProvider(provider.id, model)}
                onDelete={() => handleDelete(provider.id)}
            />
        );
    }

    return (
        <SettingsPage index={listPane}>
            {view.kind === "empty" && (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>{t("provider.emptyList")}</EmptyTitle>
                        <EmptyDescription>
                            {t("provider.emptyDesc")}
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button type="button" onClick={() => setCreating(true)}>
                            {t("provider.newProvider")}
                        </Button>
                    </EmptyContent>
                </Empty>
            )}
        </SettingsPage>
    );
}
