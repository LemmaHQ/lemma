import {
    AnchoredPicker,
    ChevronDownIcon,
    type AnchoredPickerGroup,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

import type { ModelSelection } from "../useModelSelection";
import type { SessionProviderGroup } from "./SessionComposer";

interface ModelPickerPopoverProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    model: ModelSelection | null;
    providers: SessionProviderGroup[];
    onSelectModel: (selection: ModelSelection) => void;
    onOpenProviders: () => void;
}

/** Searchable model picker popover grouped by provider, including disabled provider links. */
export function ModelPickerPopover({
    open,
    onOpenChange,
    model,
    providers,
    onSelectModel,
    onOpenProviders,
}: ModelPickerPopoverProps) {
    const { t } = useTranslation();

    const groups: AnchoredPickerGroup[] = providers.flatMap((provider) => {
        if (!provider.enabled) {
            return [
                {
                    id: provider.id,
                    label: provider.name,
                    actionLabel: t("session.providerDisabledGoSettings"),
                    onAction: () => {
                        onOpenChange(false);
                        onOpenProviders();
                    },
                    items: [],
                },
            ];
        }
        if (provider.models.length === 0) {
            return [];
        }
        return [
            {
                id: provider.id,
                label: provider.name,
                items: provider.models.map((entry) => ({
                    id: `${provider.id}:${entry.id}`,
                    label: entry.id,
                    mono: true,
                    selected:
                        model?.providerId === provider.id &&
                        model.model === entry.id,
                    onSelect: () => {
                        onSelectModel({
                            providerId: provider.id,
                            model: entry.id,
                        });
                    },
                })),
            },
        ];
    });

    const hasEnabledModels = providers.some(
        (provider) => provider.enabled && provider.models.length > 0,
    );

    const footerAction = hasEnabledModels
        ? undefined
        : {
              label: t("session.noModelAction"),
              onSelect: onOpenProviders,
          };

    return (
        <AnchoredPicker
            open={open}
            onOpenChange={onOpenChange}
            side="top"
            searchPlaceholder={t("session.filterModels")}
            emptyText={
                providers.length === 0
                    ? t("session.noProvider")
                    : t("provider.noModels")
            }
            groups={groups}
            footerAction={footerAction}
            trigger={
                <button
                    type="button"
                    className="inline-flex max-w-44 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-small text-muted-foreground transition-colors duration-base hover:bg-selected hover:text-foreground"
                >
                    <span className="min-w-0 truncate">
                        {model?.model ?? t("session.selectModel")}
                    </span>
                    <span aria-hidden="true" className="shrink-0">
                        <ChevronDownIcon size={14} />
                    </span>
                </button>
            }
        />
    );
}
