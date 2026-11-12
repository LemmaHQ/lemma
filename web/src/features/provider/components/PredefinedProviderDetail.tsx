import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
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
        <div className="max-w-3xl px-4 py-6 md:px-6">
            <div className="border-b pb-4">
                <ProviderHeader
                    name={provider.name}
                    enabled={provider.enabled}
                    toggleDisabled={provider.apiKey === ""}
                    onToggleEnabled={onToggleEnabled}
                />
                {provider.apiKey === "" && (
                    <FieldDescription className="mt-2 text-right">
                        {t("provider.enableNeedsKey")}
                    </FieldDescription>
                )}
            </div>

            <FieldGroup className="mt-6">
                <ApiKeyField value={apiKey} onChange={setApiKey} />
                <Field orientation="responsive">
                    <FieldContent>
                        <FieldLabel htmlFor="provider-default-api-format">
                            {t("provider.defaultApiFormat")}
                        </FieldLabel>
                        <FieldDescription>
                            {t("provider.defaultApiFormatDesc")}
                        </FieldDescription>
                    </FieldContent>
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
                            className="@md/field-group:shrink-0 @md/field-group:basis-80"
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
                </Field>
                <ConnectionCheck
                    models={provider.models.map((model) => model.id)}
                    target={`${provider.apiKey}\n${provider.defaultApiFormat}`}
                    disabled={dirty || provider.apiKey === ""}
                    onCheck={(model) => onCheck({ id: provider.id, model })}
                />
                {error !== null && <FieldError>{error}</FieldError>}
                {dirty && (
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
                )}
            </FieldGroup>

            <PredefinedModelList models={provider.models} />
        </div>
    );
}
