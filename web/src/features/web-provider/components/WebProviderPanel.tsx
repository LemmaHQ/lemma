import { ScrollArea, Skeleton, Switch, toast } from "@lemma/ui";
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
        <ScrollArea className="min-h-0 flex-1">
            {store.loaded ? (
                <div className="flex max-w-3xl flex-col gap-8 px-4 py-6 md:px-6">
                    <section>
                        <h2 className="text-title">
                            {t("provider.webBackends")}
                        </h2>
                        <p className="mt-1 mb-4 text-small text-muted-foreground">
                            {t("provider.webBackendsDesc")}
                        </p>
                        <div className="flex flex-col gap-3">
                            {store.list
                                .filter(
                                    (provider) => provider.kind !== "native",
                                )
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
                                .filter(
                                    (provider) => provider.kind === "native",
                                )
                                .map((provider) => (
                                    <article
                                        key={provider.id}
                                        className="rounded-lg border p-4"
                                    >
                                        <header className="flex items-center gap-3">
                                            <h3 className="text-title">
                                                {provider.name}
                                            </h3>
                                            <Switch
                                                className="ml-auto"
                                                checked={provider.enabled}
                                                onCheckedChange={(enabled) =>
                                                    void applyPatch(() =>
                                                        store.update(
                                                            provider.id,
                                                            {
                                                                enabled,
                                                            },
                                                        ),
                                                    )
                                                }
                                                aria-label={t(
                                                    "provider.enableWebProvider",
                                                    { name: provider.name },
                                                )}
                                            />
                                        </header>
                                        <p className="mt-2 text-small text-muted-foreground">
                                            {t("provider.webNativeDesc")}
                                        </p>
                                    </article>
                                ))}
                        </div>
                    </section>
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
                </div>
            ) : (
                <output
                    aria-label={t("common.loading")}
                    className="flex max-w-3xl flex-col gap-4 px-4 py-6 md:px-6"
                >
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-24 w-full" />
                </output>
            )}
        </ScrollArea>
    );
}
