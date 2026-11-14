import {
    Button,
    PlusIcon,
    Skeleton,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    cn,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

import type { Provider } from "../store";

interface ProviderListPaneProps {
    providers: Provider[];
    loaded: boolean;
    creating: boolean;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
}

function ProviderGroup({
    label,
    providers,
    selectedId,
    onSelect,
    spaced,
}: {
    label: string;
    providers: Provider[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    spaced: boolean;
}) {
    return (
        <div className={cn("flex flex-col gap-0.5", spaced && "mt-3.5")}>
            <div className="px-2 pb-1 text-caption text-subtle-foreground">
                {label}
            </div>
            {providers.map((provider) => {
                const active = provider.id === selectedId;
                const displayName =
                    provider.name === "" ? provider.identifier : provider.name;
                return (
                    <Tooltip key={provider.id}>
                        <TooltipTrigger
                            render={
                                <Button
                                    type="button"
                                    variant="row"
                                    data-active={active ? "" : undefined}
                                    aria-pressed={active}
                                    onClick={() => onSelect(provider.id)}
                                />
                            }
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "size-1.5 shrink-0 rounded-full",
                                    provider.enabled
                                        ? "bg-foreground"
                                        : "bg-input",
                                )}
                            />
                            <span className="min-w-0 flex-1 truncate">
                                {displayName}
                            </span>
                            <span className="shrink-0 text-caption text-subtle-foreground tabular-nums">
                                {provider.models.length}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            {displayName}
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
}

const SKELETON_ROW_WIDTHS = ["w-3/5", "w-2/5", "w-1/2"];

/** Sticky 220px provider directory grouping predefined and custom providers above the create action. */
export function ProviderListPane({
    providers,
    loaded,
    creating,
    selectedId,
    onSelect,
    onCreate,
}: ProviderListPaneProps) {
    const { t } = useTranslation();
    const predefinedProviders = providers.filter(
        (p) => p.source === "predefined",
    );
    const customProviders = providers.filter((p) => p.source === "custom");

    return (
        <section
            aria-label={t("settings.aiProviders")}
            className="flex flex-col"
        >
            {loaded ? (
                <>
                    {predefinedProviders.length > 0 && (
                        <ProviderGroup
                            label={t("provider.predefinedGroup")}
                            providers={predefinedProviders}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            spaced={false}
                        />
                    )}
                    {customProviders.length > 0 && (
                        <ProviderGroup
                            label={t("provider.customGroup")}
                            providers={customProviders}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            spaced={predefinedProviders.length > 0}
                        />
                    )}
                    <Button
                        type="button"
                        variant="row"
                        data-active={creating ? "" : undefined}
                        aria-pressed={creating}
                        onClick={onCreate}
                        className={providers.length > 0 ? "mt-2.5" : undefined}
                    >
                        <PlusIcon className="size-3.5 shrink-0" />
                        <span className="truncate">
                            {t("provider.newProvider")}
                        </span>
                    </Button>
                </>
            ) : (
                <output
                    aria-label={t("common.loading")}
                    className="flex flex-col gap-1 px-2 py-1"
                >
                    {SKELETON_ROW_WIDTHS.map((width) => (
                        <div
                            key={width}
                            className="flex h-8 items-center gap-2"
                        >
                            <Skeleton shape="circle" className="size-1.5" />
                            <div className={width}>
                                <Skeleton className="h-3.5" />
                            </div>
                        </div>
                    ))}
                </output>
            )}
        </section>
    );
}
