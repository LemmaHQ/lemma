import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ProviderKind } from "@/gen/lemma/v1/provider_pb";
import { errorText } from "@/data/rpc/errors";

export interface NewProviderData {
    kind: ProviderKind;
    identifier: string;
    name: string;
    baseUrl: string;
    apiKey: string;
}

interface NewProviderFormProps {
    onSave: (data: NewProviderData) => Promise<void>;
    onCancel: () => void;
}

const KIND_OPTIONS = [
    { value: "openai", kind: ProviderKind.OPENAI },
    { value: "anthropic", kind: ProviderKind.ANTHROPIC },
    { value: "gemini", kind: ProviderKind.GEMINI },
] as const;

const requiredMark = <span className="text-destructive">*</span>;

export function NewProviderForm({ onSave, onCancel }: NewProviderFormProps) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [kind, setKind] = useState<ProviderKind>(ProviderKind.OPENAI);
    const [identifier, setIdentifier] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);

    const handleKindChange = (value: string) => {
        const option = KIND_OPTIONS.find((o) => o.value === value);
        if (!option) {
            return;
        }
        setKind(option.kind);
    };

    const handleSave = async () => {
        const trimmedIdentifier = identifier.trim();
        if (!/^[\x20-\x7E]+$/.test(trimmedIdentifier)) {
            setFailed(t("providers.identifierInvalid"));
            return;
        }
        if (!baseUrl.trim()) {
            setFailed(t("errors.providerFieldsRequired"));
            return;
        }
        setBusy(true);
        setFailed(null);
        try {
            await onSave({
                kind,
                identifier: trimmedIdentifier,
                name: name.trim() || trimmedIdentifier,
                baseUrl: baseUrl.trim(),
                apiKey: apiKey.trim(),
            });
        } catch (e) {
            setFailed(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="max-w-3xl px-8 py-6">
            <h2 className="text-base font-semibold">
                {t("providers.newProvider")}
            </h2>
            <div className="mt-6 flex max-w-md flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="np-kind">
                        {requiredMark} {t("providers.type")}
                    </Label>
                    <Select
                        value={KIND_OPTIONS.find((o) => o.kind === kind)?.value}
                        onValueChange={handleKindChange}
                    >
                        <SelectTrigger id="np-kind" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {KIND_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.value}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="np-identifier">
                        {requiredMark} {t("providers.identifier")}
                    </Label>
                    <Input
                        id="np-identifier"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={t("providers.identifierPlaceholder")}
                    />
                    <p className="text-xs text-muted-foreground">
                        {t("providers.identifierHint")}
                    </p>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="np-name">{t("providers.name")}</Label>
                    <Input
                        id="np-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("providers.namePlaceholder")}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="np-baseurl">
                        {requiredMark} {t("providers.baseUrl")}
                    </Label>
                    <Input
                        id="np-baseurl"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder={t("providers.baseUrlPlaceholder")}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="np-apikey">{t("providers.apiKey")}</Label>
                    <div className="relative">
                        <Input
                            id="np-apikey"
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={t("providers.apiKeyPlaceholder")}
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
                </div>
                {failed && <p className="text-xs text-destructive">{failed}</p>}
                <div className="flex items-center gap-2 pt-2">
                    <Button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={busy}
                    >
                        {t("common.save")}
                    </Button>
                    <Button type="button" variant="outline" onClick={onCancel}>
                        {t("common.cancel")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
