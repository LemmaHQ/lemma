import {
    Avatar,
    AvatarFallback,
    SettingsPage,
    SettingsSection,
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
        <SettingsPage
            title={provider.name}
            media={
                <Avatar>
                    <AvatarFallback>
                        {provider.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
            }
            actions={
                <>
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
                        aria-label={t("provider.enableProvider")}
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
            </SettingsSection>
            <ModelList
                models={provider.models}
                onChange={onModelsChange}
                onFetch={onFetchModels}
            />
        </SettingsPage>
    );
}
