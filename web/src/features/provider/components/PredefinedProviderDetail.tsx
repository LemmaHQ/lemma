import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SettingsField,
    SettingsSectionCompact,
} from "@lemma/ui";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { API_FORMAT_I18N_KEYS, type ApiFormat } from "../api-format";
import type { PredefinedProvider, PredefinedProviderPatch } from "../store";
import { ApiKeyField } from "./ApiKeyField";
import { ConnectionCheck } from "./ConnectionCheck";
import { PredefinedModelList } from "./PredefinedModelList";
import { ProviderHeader } from "./ProviderHeader";
import { SaveBar } from "./SaveBar";

interface PredefinedProviderDetailProps {
    index?: ReactNode;
    provider: PredefinedProvider;
    onSave: (patch: PredefinedProviderPatch) => Promise<void>;
    onToggleEnabled: (enabled: boolean) => void;
    onDefaultApiFormatChange: (apiFormat: ApiFormat) => void;
    onCheck: (model: string) => Promise<string>;
}

export function PredefinedProviderDetail({
    index,
    provider,
    onSave,
    onToggleEnabled,
    onDefaultApiFormatChange,
    onCheck,
}: PredefinedProviderDetailProps) {
    const { t } = useTranslation();
    const [apiKey, setApiKey] = useState(provider.apiKey);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const trimmedKey = apiKey.trim();
    const dirty = trimmedKey !== provider.apiKey;
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await onSave({ apiKey: trimmedKey });
            setApiKey(trimmedKey);
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    return (
        <ProviderHeader
            index={index}
            name={provider.name}
            badge={t("provider.predefinedBadge")}
            enabled={provider.enabled}
            toggleDisabled={
                !provider.enabled && (provider.apiKey === "" || dirty)
            }
            onToggleEnabled={onToggleEnabled}
        >
            <SettingsSectionCompact
                error={error}
                footer={
                    dirty && (
                        <SaveBar
                            message={t("provider.unsavedChanges")}
                            busy={busy}
                            saveDisabled={false}
                            onSave={() => void save()}
                            onCancel={() => {
                                setApiKey(provider.apiKey);
                                setError(null);
                            }}
                        />
                    )
                }
            >
                <ApiKeyField
                    value={apiKey}
                    description={
                        provider.apiKey === ""
                            ? t("provider.enableNeedsKey")
                            : undefined
                    }
                    onChange={setApiKey}
                />
                <SettingsField
                    label={t("provider.defaultApiFormat")}
                    htmlFor="provider-default-api-format"
                    description={t("provider.defaultApiFormatDesc")}
                >
                    <Select
                        value={provider.defaultApiFormat}
                        onValueChange={(value) => {
                            for (const format of provider.apiFormats.filter(
                                (option) => option === value,
                            )) {
                                onDefaultApiFormatChange(format);
                            }
                        }}
                    >
                        <SelectTrigger
                            id="provider-default-api-format"
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {provider.apiFormats.map((format) => (
                                <SelectItem key={format} value={format}>
                                    {t(API_FORMAT_I18N_KEYS[format])}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingsField>
            </SettingsSectionCompact>
            <PredefinedModelList models={provider.models} />
            <SettingsSectionCompact title={t("provider.diagnostics")}>
                <ConnectionCheck
                    models={provider.models.map((model) => model.id)}
                    target={{ apiKey, apiFormat: provider.defaultApiFormat }}
                    disabled={dirty || provider.apiKey === ""}
                    onCheck={onCheck}
                />
            </SettingsSectionCompact>
        </ProviderHeader>
    );
}
