import { SettingsRow, SettingsSectionCompact } from "@lemma/ui";
import { useTranslation } from "react-i18next";

import type { Model } from "../store";

interface PredefinedModelListProps {
    models: Model[];
}

export function PredefinedModelList({ models }: PredefinedModelListProps) {
    const { t } = useTranslation();
    return (
        <SettingsSectionCompact
            title={t("provider.modelList")}
            actions={
                <span className="text-caption text-subtle-foreground">
                    {t("provider.modelsReadOnly")}
                </span>
            }
        >
            {models.map((model) => (
                <SettingsRow
                    key={model.id}
                    label={
                        <span className="font-mono text-small">{model.id}</span>
                    }
                >
                    <span className="text-caption text-muted-foreground">
                        {model.toolCalling
                            ? t("provider.toolsSupported")
                            : t("provider.toolsUnsupported")}
                    </span>
                </SettingsRow>
            ))}
        </SettingsSectionCompact>
    );
}
