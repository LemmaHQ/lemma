import { Input, SettingsField, SettingsSectionCompact, cn } from "@lemma/ui";
import { useId, useState, type ReactNode } from "react";
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
import { ModelList } from "./ModelList";
import { ProviderHeader } from "./ProviderHeader";
import { SaveBar } from "./SaveBar";

interface ProviderDetailProps {
    index?: ReactNode;
    provider: CustomProvider;
    onSave: (patch: CustomProviderPatch) => Promise<void>;
    onToggleEnabled: (enabled: boolean) => void;
    onModelsChange: (models: Model[]) => void;
    onFetchModels: () => Promise<string[]>;
    onCheck: (model: string) => Promise<string>;
    onDelete: () => Promise<void>;
}

/** Settings canvas of one custom provider: connection fields, model list, diagnostics, and inline two-step delete. */
export function ProviderDetail({
    index,
    provider,
    onSave,
    onToggleEnabled,
    onModelsChange,
    onFetchModels,
    onCheck,
    onDelete,
}: ProviderDetailProps) {
    const { t } = useTranslation();
    const nameId = useId();
    const saved: ConnectionValues = {
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
        apiPath: provider.apiPath,
        modelsPath: provider.modelsPath,
    };
    const [name, setName] = useState(provider.name);
    const [values, setValues] = useState(saved);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const nextName = name.trim() === "" ? provider.identifier : name.trim();
    const connPatch = connectionPatch(values, saved);
    const patch: CustomProviderPatch =
        nextName === provider.name
            ? connPatch
            : { ...connPatch, name: nextName };
    const dirty = Object.keys(patch).length > 0;

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await onSave(patch);
            setName(nextName);
            setValues({
                apiKey: values.apiKey.trim(),
                baseUrl: values.baseUrl.trim(),
                apiPath: values.apiPath.trim(),
                modelsPath: values.modelsPath.trim(),
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
        <ProviderHeader
            index={index}
            name={provider.name}
            badge={t("provider.customBadge")}
            enabled={provider.enabled}
            toggleDisabled={false}
            onToggleEnabled={onToggleEnabled}
        >
            <SettingsSectionCompact
                error={error}
                footer={
                    dirty && (
                        <SaveBar
                            message={t("provider.unsavedChanges")}
                            busy={busy}
                            saveDisabled={!isBaseUrlValid(values.baseUrl)}
                            onSave={() => void save()}
                            onCancel={() => {
                                setName(provider.name);
                                setValues(saved);
                                setError(null);
                            }}
                        />
                    )
                }
            >
                <SettingsField
                    label={t("provider.apiFormat")}
                    description={t("provider.apiFormatDesc")}
                >
                    <div className="text-small text-muted-foreground">
                        <span>
                            {t(API_FORMAT_I18N_KEYS[provider.apiFormat])}
                        </span>
                        <span className="mx-2 text-subtle-foreground">·</span>
                        <span>
                            ID{" "}
                            <code className="font-mono text-foreground">
                                {provider.identifier}
                            </code>
                        </span>
                    </div>
                </SettingsField>
                <SettingsField
                    label={t("provider.name")}
                    htmlFor={nameId}
                    description={t("provider.nameDesc")}
                >
                    <Input
                        id={nameId}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={provider.identifier}
                    />
                </SettingsField>
                <ConnectionFields
                    apiFormat={provider.apiFormat}
                    values={values}
                    onChange={setValues}
                />
            </SettingsSectionCompact>
            <ModelList
                models={provider.models}
                fetchDisabled={dirty}
                onChange={onModelsChange}
                onFetch={onFetchModels}
            />
            <SettingsSectionCompact title={t("provider.diagnostics")}>
                <ConnectionCheck
                    models={provider.models.map((model) => model.id)}
                    target={{
                        apiKey: values.apiKey,
                        baseUrl: values.baseUrl,
                        apiPath: values.apiPath,
                        apiFormat: provider.apiFormat,
                    }}
                    disabled={dirty}
                    onCheck={onCheck}
                />
            </SettingsSectionCompact>
            <div className="mt-5 border-t border-border pt-3">
                <button
                    type="button"
                    onClick={() => {
                        if (!confirmingDelete) {
                            setConfirmingDelete(true);
                            return;
                        }
                        setConfirmingDelete(false);
                        void handleDelete();
                    }}
                    onBlur={() => setConfirmingDelete(false)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.preventDefault();
                            setConfirmingDelete(false);
                        }
                    }}
                    className={cn(
                        "-ml-2 cursor-pointer rounded-md px-2 py-1 text-small transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-ring",
                        confirmingDelete
                            ? "bg-selected text-destructive"
                            : "text-subtle-foreground hover:bg-selected hover:text-destructive",
                    )}
                >
                    {confirmingDelete
                        ? t("provider.deleteConfirmInline")
                        : t("provider.deleteProvider")}
                </button>
            </div>
        </ProviderHeader>
    );
}
