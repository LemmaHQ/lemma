import {
    SettingsField,
    SettingsPage,
    SettingsSection,
    Skeleton,
    Switch,
    toast,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import type { WebFunction, WebProvider } from "../store";
import { useWebProviders } from "../useWebProviders";
import { WebProviderDetail } from "./WebProviderDetail";
import { WebProviderOrder } from "./WebProviderOrder";

export function WebProviderPanel() {
    const { t } = useTranslation();
    const store = useWebProviders();
    const searchProviders = store.list
        .filter((provider) => provider.kind !== "native")
        .toSorted((a, b) => a.searchRank - b.searchRank);
    const fetchProviders = store.list.toSorted(
        (a, b) => a.fetchRank - b.fetchRank,
    );

    const applyPatch = async (update: () => Promise<void>) => {
        try {
            await update();
        } catch (e) {
            toast.error(errorText(e, t));
        }
    };

    const move = (
        fn: WebFunction,
        providers: WebProvider[],
        index: number,
        direction: -1 | 1,
    ) => {
        const ids = providers.map((provider) => provider.id);
        const target = index + direction;
        const moved = ids.splice(index, 1);
        ids.splice(target, 0, ...moved);
        void applyPatch(() => store.setOrder(fn, ids));
    };

    return (
        <SettingsPage title={t("settings.web")}>
            {store.loaded ? (
                <>
                    {store.list
                        .filter((provider) => provider.kind !== "native")
                        .map((provider) => (
                            <WebProviderDetail
                                key={provider.id}
                                provider={provider}
                                onSave={(apiKey) =>
                                    store.update(provider.id, {
                                        apiKey,
                                    })
                                }
                                onToggleEnabled={(enabled) =>
                                    void applyPatch(() =>
                                        store.update(provider.id, {
                                            enabled,
                                        }),
                                    )
                                }
                            />
                        ))}
                    {store.list
                        .filter((provider) => provider.kind === "native")
                        .map((provider) => (
                            <SettingsSection
                                key={provider.id}
                                title={provider.name}
                            >
                                <SettingsField
                                    label={t("provider.enableWebProvider", {
                                        name: provider.name,
                                    })}
                                    description={t("provider.webNativeDesc")}
                                >
                                    <Switch
                                        checked={provider.enabled}
                                        onCheckedChange={(enabled) =>
                                            void applyPatch(() =>
                                                store.update(provider.id, {
                                                    enabled,
                                                }),
                                            )
                                        }
                                        aria-label={t(
                                            "provider.enableWebProvider",
                                            { name: provider.name },
                                        )}
                                    />
                                </SettingsField>
                            </SettingsSection>
                        ))}
                    <WebProviderOrder
                        title={t("provider.webSearchOrder")}
                        description={t("provider.webSearchOrderDesc")}
                        providers={searchProviders}
                        onMove={(index, direction) =>
                            move("search", searchProviders, index, direction)
                        }
                    />
                    <WebProviderOrder
                        title={t("provider.webFetchOrder")}
                        description={t("provider.webFetchOrderDesc")}
                        providers={fetchProviders}
                        onMove={(index, direction) =>
                            move("fetch", fetchProviders, index, direction)
                        }
                    />
                </>
            ) : (
                <output
                    aria-label={t("common.loading")}
                    className="flex flex-col gap-4"
                >
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-24 w-full" />
                </output>
            )}
        </SettingsPage>
    );
}
