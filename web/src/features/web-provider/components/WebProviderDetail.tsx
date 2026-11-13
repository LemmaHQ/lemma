import {
    Button,
    PasswordInput,
    SettingsField,
    SettingsSection,
    Switch,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import type { WebProvider } from "../store";

interface WebProviderDetailProps {
    provider: WebProvider;
    onSave: (apiKey: string) => Promise<void>;
    onToggleEnabled: (enabled: boolean) => void;
}

export function WebProviderDetail({
    provider,
    onSave,
    onToggleEnabled,
}: WebProviderDetailProps) {
    const { t } = useTranslation();
    const [apiKey, setApiKey] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const trimmedKey = apiKey.trim();
    const dirty = trimmedKey !== "";
    const inputId = `web-provider-api-key-${provider.id}`;

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await onSave(trimmedKey);
            setApiKey("");
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    return (
        <SettingsSection
            title={provider.name}
            actions={
                <Switch
                    checked={provider.enabled}
                    disabled={!provider.hasKey || busy}
                    onCheckedChange={onToggleEnabled}
                    aria-label={t("provider.enableWebProvider", {
                        name: provider.name,
                    })}
                />
            }
            error={error}
            footer={
                dirty && (
                    <div className="flex animate-in items-center justify-between gap-3 rounded-lg border bg-muted py-2 pr-2 pl-4 text-small text-muted-foreground duration-base ease-enter fade-in slide-in-from-top-1">
                        <span>{t("provider.unsavedChanges")}</span>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                    setApiKey("");
                                    setError(null);
                                }}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button
                                type="button"
                                loading={busy}
                                onClick={() => void save()}
                            >
                                {t("common.save")}
                            </Button>
                        </div>
                    </div>
                )
            }
        >
            <SettingsField
                label={t("provider.apiKey")}
                htmlFor={inputId}
                description={
                    provider.hasKey
                        ? t("provider.apiKeySavedDesc")
                        : t("provider.enableNeedsKey")
                }
            >
                <PasswordInput
                    showLabel={t("passwordInput.show")}
                    hideLabel={t("passwordInput.hide")}
                    id={inputId}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={t("provider.apiKeyPlaceholder")}
                    autoComplete="off"
                />
            </SettingsField>
        </SettingsSection>
    );
}
