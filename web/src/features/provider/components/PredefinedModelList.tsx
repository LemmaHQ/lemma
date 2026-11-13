import { SettingsRow, SettingsSection, Switch } from "@lemma/ui";
import { useTranslation } from "react-i18next";

import type { Model } from "../store";

interface PredefinedModelListProps {
    models: Model[];
}

export function PredefinedModelList({ models }: PredefinedModelListProps) {
    const { t } = useTranslation();
    return (
        <SettingsSection
            title={t("provider.modelList")}
            actions={
                <span className="text-small text-muted-foreground">
                    {t("provider.modelsReadOnly")}
                </span>
            }
        >
            {models.map((model) => (
                <SettingsRow key={model.id} label={model.id}>
                    <span className="text-small text-muted-foreground">
                        {t("provider.toolCalling")}
                    </span>
                    <Switch
                        checked={model.toolCalling}
                        disabled
                        aria-label={`${model.id} ${t("provider.toolCalling")}`}
                    />
                </SettingsRow>
            ))}
        </SettingsSection>
    );
}
