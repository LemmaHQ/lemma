import { Eye, EyeOff, Lock, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Provider } from "@/gen/lemma/v1/provider_pb";
import { errorText } from "@/data/rpc/errors";

import { ModelList } from "./ModelList";

function FieldRow({
    label,
    description,
    children,
}: {
    label: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-6 border-b border-border/60 py-4">
            <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    {description}
                </p>
            </div>
            <div className="flex w-95 shrink-0 items-center justify-end gap-2">
                {children}
            </div>
        </div>
    );
}

interface ProviderDetailProps {
    provider: Provider;
    onToggleEnabled: (enabled: boolean) => void;
    onSaveBaseUrl: (baseUrl: string) => Promise<void>;
    onSaveApiKey: (apiKey: string) => Promise<void>;
    onModelsChange: (models: string[]) => void;
    onFetchModels: () => Promise<string[]>;
    onDelete: () => void | Promise<void>;
}

export function ProviderDetail({
    provider,
    onToggleEnabled,
    onSaveBaseUrl,
    onSaveApiKey,
    onModelsChange,
    onFetchModels,
    onDelete,
}: ProviderDetailProps) {
    const { t } = useTranslation();
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
    const [savingKey, setSavingKey] = useState(false);
    const [savingUrl, setSavingUrl] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const apiKeyDirty = apiKey.trim().length > 0;
    const baseUrlDirty =
        baseUrl.trim() !== provider.baseUrl && baseUrl.trim().length > 0;

    const saveApiKey = async () => {
        setSavingKey(true);
        setError(null);
        try {
            await onSaveApiKey(apiKey.trim());
            setApiKey("");
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setSavingKey(false);
        }
    };

    const saveBaseUrl = async () => {
        setSavingUrl(true);
        setError(null);
        try {
            await onSaveBaseUrl(baseUrl.trim());
        } catch (e) {
            setBaseUrl(provider.baseUrl);
            setError(errorText(e, t));
        } finally {
            setSavingUrl(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(t("providers.deleteConfirm"))) {
            return;
        }
        setError(null);
        try {
            await onDelete();
        } catch (e) {
            setError(errorText(e, t));
        }
    };

    return (
        <div className="max-w-3xl px-8 py-6">
            <header className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background text-sm font-semibold">
                    {provider.name.charAt(0).toUpperCase()}
                </span>
                <h2 className="text-base font-semibold">{provider.name}</h2>
                <div className="ml-auto flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t("providers.deleteProvider")}
                        onClick={() => void handleDelete()}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                    <Switch
                        checked={provider.enabled}
                        onCheckedChange={onToggleEnabled}
                        aria-label={t("providers.enableProvider")}
                    />
                </div>
            </header>

            <section className="mt-4">
                <FieldRow
                    label={t("providers.apiKey")}
                    description={t("providers.apiKeyKeepHint")}
                >
                    <div className="relative flex-1">
                        <Input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={
                                provider.apiKey ||
                                t("providers.apiKeyPlaceholder")
                            }
                            className="pr-9"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey((v) => !v)}
                            aria-label={
                                showKey
                                    ? t("providers.hideApiKey")
                                    : t("providers.showApiKey")
                            }
                            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {showKey ? (
                                <EyeOff className="size-4" />
                            ) : (
                                <Eye className="size-4" />
                            )}
                        </button>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        disabled={!apiKeyDirty || savingKey}
                        onClick={() => void saveApiKey()}
                    >
                        {t("common.save")}
                    </Button>
                </FieldRow>

                <FieldRow
                    label={t("providers.baseUrl")}
                    description={t("providers.baseUrlDesc")}
                >
                    <Input
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder={t("providers.baseUrlPlaceholder")}
                        className="flex-1 font-mono text-xs"
                    />
                    <Button
                        type="button"
                        size="sm"
                        disabled={!baseUrlDirty || savingUrl}
                        onClick={() => void saveBaseUrl()}
                    >
                        {t("common.save")}
                    </Button>
                </FieldRow>

                {error && (
                    <p className="pt-2 text-xs text-destructive">{error}</p>
                )}

                <p className="flex items-center gap-1.5 pt-4 text-xs text-muted-foreground">
                    <Lock className="size-3.5" />
                    {t("providers.securityNote")}
                </p>
            </section>

            <ModelList
                models={provider.models}
                onChange={onModelsChange}
                onFetch={onFetchModels}
            />
        </div>
    );
}
