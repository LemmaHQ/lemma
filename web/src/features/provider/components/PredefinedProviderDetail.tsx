import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SettingsField,
    SettingsSection,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { API_FORMAT_I18N_KEYS, type ApiFormat } from "../api-format";
import type {
    CheckRequest,
    PredefinedProvider,
    PredefinedProviderPatch,
} from "../store";
import { ApiKeyField } from "./ApiKeyField";
import { ConnectionCheck } from "./ConnectionCheck";
import { PredefinedModelList } from "./PredefinedModelList";
import { ProviderHeader } from "./ProviderHeader";
import { SaveBar } from "./SaveBar";

interface PredefinedProviderDetailProps {
    provider: PredefinedProvider;
    onSave: (patch: PredefinedProviderPatch) => Promise<void>;
    onToggleEnabled: (enabled: boolean) => void;
    onDefaultApiFormatChange: (apiFormat: ApiFormat) => void;
    onCheck: (req: CheckRequest) => Promise<string>;
}

export function PredefinedProviderDetail({
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
            name={provider.name}
            enabled={provider.enabled}
            toggleDisabled={provider.apiKey === ""}
            onToggleEnabled={onToggleEnabled}
        >
            <SettingsSection
                title={t("provider.connection")}
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
                <ConnectionCheck
                    models={provider.models.map((model) => model.id)}
                    target={`${provider.apiKey}\n${provider.defaultApiFormat}`}
                    disabled={dirty || provider.apiKey === ""}
                    onCheck={(model) => onCheck({ id: provider.id, model })}
                />
            </SettingsSection>
            <PredefinedModelList models={provider.models} />
        </ProviderHeader>
    );
}
