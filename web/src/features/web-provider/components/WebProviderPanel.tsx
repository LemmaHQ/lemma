import { SettingsPage, SettingsSection, Skeleton, toast } from "@lemma/ui";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import {
    isWebProviderActive,
    type WebFunction,
    type WebProvider,
} from "../store";
import { useWebProviders } from "../useWebProviders";
import { WebProviderDetail } from "./WebProviderDetail";
import { WebProviderOrder } from "./WebProviderOrder";

/** Web search and fetch backend configuration and priority settings page. */
export function WebProviderPanel() {
    const { t } = useTranslation();
    const store = useWebProviders();
    const searchProviders = store.list
        .filter((provider) => provider.kind !== "native")
        .toSorted((a, b) => a.searchRank - b.searchRank);
    const fetchProviders = store.list.toSorted(
        (a, b) => a.fetchRank - b.fetchRank,
    );

    const reorder = async (fn: WebFunction, ids: string[]) => {
        try {
            await store.setOrder(fn, ids);
        } catch (e) {
            toast.error(errorText(e, t));
        }
    };

    return (
        <SettingsPage>
            {store.loaded ? (
                <>
                    <SettingsSection
                        title={t("provider.webBackends")}
                        description={t("provider.webBackendsDesc")}
                    >
                        {store.list.map((provider) => (
                            <WebProviderDetail
                                key={provider.id}
                                provider={provider}
                                onUpdate={(patch) =>
                                    store.update(provider.id, patch)
                                }
                            />
                        ))}
                    </SettingsSection>
                    <SettingsSection
                        title={t("provider.webSearchOrder")}
                        description={t("provider.webSearchOrderDesc")}
                        meta={activeChainMeta("web_search", searchProviders, t)}
                    >
                        <WebProviderOrder
                            fn="search"
                            providers={searchProviders}
                            onReorder={(ids) => void reorder("search", ids)}
                        />
                    </SettingsSection>
                    <SettingsSection
                        title={t("provider.webFetchOrder")}
                        description={t("provider.webFetchOrderDesc")}
                        meta={activeChainMeta("web_fetch", fetchProviders, t)}
                    >
                        <WebProviderOrder
                            fn="fetch"
                            providers={fetchProviders}
                            onReorder={(ids) => void reorder("fetch", ids)}
                        />
                    </SettingsSection>
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

function activeChainMeta(
    tool: string,
    providers: WebProvider[],
    t: TFunction,
): string {
    const names = providers
        .filter(isWebProviderActive)
        .map((provider) => provider.name);
    if (names.length === 0) {
        return t("provider.webInactiveTool", { tool });
    }
    return t("provider.webActiveChain", {
        tool,
        chain: names.join(" → "),
    });
}
