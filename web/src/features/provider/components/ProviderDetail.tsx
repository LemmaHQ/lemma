import { Input, SettingsField, SettingsSection } from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { API_FORMAT_I18N_KEYS } from "../api-format";
import {
    connectionPatch,
    isBaseUrlValid,
    type ConnectionValues,
} from "../connection";
import type { CustomProvider, CustomProviderPatch, Model } from "../store";
import { ConnectionCheck } from "./ConnectionCheck";
import { ConnectionFields } from "./ConnectionFields";
import { DeleteProviderButton } from "./DeleteProviderButton";
import { ModelList } from "./ModelList";
import { ProviderHeader } from "./ProviderHeader";
import { ProviderSettingsDialog } from "./ProviderSettingsDialog";
import { SaveBar } from "./SaveBar";

interface ProviderDetailProps {
    provider: CustomProvider;
    onSave: (patch: CustomProviderPatch) => Promise<void>;
    onToggleEnabled: (enabled: boolean) => void;
    onModelsChange: (models: Model[]) => void;
    onFetchModels: () => Promise<string[]>;
    onCheck: (model: string) => Promise<string>;
    onDelete: () => Promise<void>;
}

/** Settings page of one custom provider: connection fields and model list. */
export function ProviderDetail({
    provider,
    onSave,
    onToggleEnabled,
    onModelsChange,
    onFetchModels,
    onCheck,
    onDelete,
}: ProviderDetailProps) {
    const { t } = useTranslation();
    const saved: ConnectionValues = {
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
        apiPath: provider.apiPath,
    };
    const [values, setValues] = useState(saved);
    const [checkGeneration, setCheckGeneration] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const patch = connectionPatch(values, saved);
    const dirty = Object.keys(patch).length > 0;

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await onSave(patch);
            setValues({
                apiKey: values.apiKey.trim(),
                baseUrl: values.baseUrl.trim(),
                apiPath: values.apiPath.trim(),
            });
            setCheckGeneration((n) => n + 1);
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async () => {
        try {
            await onDelete();
        } catch (e) {
            setError(errorText(e, t));
        }
    };

    return (
        <ProviderHeader
            name={provider.name}
            enabled={provider.enabled}
            toggleDisabled={false}
            onToggleEnabled={onToggleEnabled}
            actions={
                <>
                    <ProviderSettingsDialog
                        provider={provider}
                        onSaveName={(name) => onSave({ name })}
                    />
                    <DeleteProviderButton
                        onDelete={() => void handleDelete()}
                    />
                </>
            }
        >
            <SettingsSection
                title={t("provider.connection")}
                error={error}
                footer={
                    dirty && (
                        <SaveBar
                            message={t("provider.unsavedChanges")}
                            busy={busy}
                            saveDisabled={!isBaseUrlValid(values.baseUrl)}
                            onSave={() => void save()}
                            onCancel={() => {
                                setValues(saved);
                                setError(null);
                            }}
                        />
                    )
                }
            >
                <SettingsField
                    label={t("provider.apiFormat")}
                    htmlFor="custom-provider-api-format"
                    description={t("provider.apiFormatDesc")}
                >
                    <Input
                        id="custom-provider-api-format"
                        value={t(API_FORMAT_I18N_KEYS[provider.apiFormat])}
                        readOnly
                    />
                </SettingsField>
                <ConnectionFields
                    apiFormat={provider.apiFormat}
                    values={values}
                    onChange={setValues}
                />
                <ConnectionCheck
                    models={provider.models.map((model) => model.id)}
                    target={`${provider.apiKey}\n${values.apiKey}\n${values.baseUrl}\n${values.apiPath}\n${checkGeneration}`}
                    disabled={dirty}
                    onCheck={onCheck}
                />
            </SettingsSection>
            <ModelList
                models={provider.models}
                fetchDisabled={dirty}
                onChange={onModelsChange}
                onFetch={onFetchModels}
            />
        </ProviderHeader>
    );
}
