import {
    Avatar,
    AvatarFallback,
    FieldError,
    FieldGroup,
    Switch,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import {
    connectionPatch,
    isBaseUrlValid,
    type ConnectionValues,
} from "../connection";
import type { CheckRequest, Provider, ProviderPatch } from "../store";
import { ConnectionCheck } from "./ConnectionCheck";
import { ConnectionFields } from "./ConnectionFields";
import { DeleteProviderButton } from "./DeleteProviderButton";
import { ModelList } from "./ModelList";
import { ProviderSettingsDialog } from "./ProviderSettingsDialog";
import { SaveBar } from "./SaveBar";

interface ProviderDetailProps {
    provider: Provider;
    onSave: (patch: ProviderPatch) => Promise<void>;
    onToggleEnabled: (enabled: boolean) => void;
    onModelsChange: (models: string[]) => void;
    onFetchModels: () => Promise<string[]>;
    onCheck: (req: CheckRequest) => Promise<string>;
    onDelete: () => Promise<void>;
}

/** Settings page of one provider: connection fields and model list. */
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
        <div className="max-w-3xl px-8 py-6">
            <header className="flex items-center gap-3 border-b pb-4">
                <Avatar>
                    <AvatarFallback>
                        {provider.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <h2 className="truncate text-base font-medium">
                    {provider.name}
                </h2>
                <div className="ml-auto flex items-center gap-1">
                    <ProviderSettingsDialog
                        provider={provider}
                        onSaveName={(name) => onSave({ name })}
                    />
                    <DeleteProviderButton
                        onDelete={() => void handleDelete()}
                    />
                    <Switch
                        className="ml-2"
                        checked={provider.enabled}
                        onCheckedChange={onToggleEnabled}
                        aria-label={t("providers.enableProvider")}
                    />
                </div>
            </header>

            <FieldGroup className="mt-6">
                <ConnectionFields
                    kind={provider.kind}
                    values={values}
                    onChange={setValues}
                />
                <ConnectionCheck
                    models={provider.models}
                    target={`${values.apiKey}\n${values.baseUrl}\n${values.apiPath}`}
                    disabled={!isBaseUrlValid(values.baseUrl)}
                    onCheck={(model) =>
                        onCheck(
                            dirty
                                ? { kind: provider.kind, ...values, model }
                                : { id: provider.id, model },
                        )
                    }
                />
                {error !== null && <FieldError>{error}</FieldError>}
                {dirty && (
                    <SaveBar
                        message={t("providers.unsavedChanges")}
                        busy={busy}
                        saveDisabled={!isBaseUrlValid(values.baseUrl)}
                        onSave={() => void save()}
                        onCancel={() => {
                            setValues(saved);
                            setError(null);
                        }}
                    />
                )}
            </FieldGroup>

            <ModelList
                models={provider.models}
                onChange={onModelsChange}
                onFetch={onFetchModels}
            />
        </div>
    );
}
