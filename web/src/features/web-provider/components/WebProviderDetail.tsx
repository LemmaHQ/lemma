import {
    Button,
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldLabel,
    PasswordInput,
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
        <article className="rounded-lg border p-4">
            <header className="flex items-center gap-3">
                <h3 className="text-title">{provider.name}</h3>
                <Switch
                    className="ml-auto"
                    checked={provider.enabled}
                    disabled={!provider.hasKey || busy}
                    onCheckedChange={onToggleEnabled}
                    aria-label={t("provider.enableWebProvider", {
                        name: provider.name,
                    })}
                />
            </header>
            {!provider.hasKey && (
                <FieldDescription className="mt-2 text-right">
                    {t("provider.enableNeedsKey")}
                </FieldDescription>
            )}
            <Field orientation="responsive" className="mt-4">
                <FieldContent>
                    <FieldLabel htmlFor={inputId}>
                        {t("provider.apiKey")}
                    </FieldLabel>
                    <FieldDescription>
                        {provider.hasKey
                            ? t("provider.webApiKeySavedDesc")
                            : t("provider.apiKeyDesc")}
                    </FieldDescription>
                </FieldContent>
                <PasswordInput
                    showLabel={t("passwordInput.show")}
                    hideLabel={t("passwordInput.hide")}
                    id={inputId}
                    className="@md/field-group:shrink-0 @md/field-group:basis-80"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={t("provider.apiKeyPlaceholder")}
                    autoComplete="off"
                />
            </Field>
            {error !== null && <FieldError>{error}</FieldError>}
            {dirty && (
                <div className="mt-4 flex animate-in items-center justify-between gap-3 rounded-lg border bg-muted py-2 pr-2 pl-4 text-small text-muted-foreground duration-base ease-enter fade-in slide-in-from-top-1">
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
            )}
        </article>
    );
}
