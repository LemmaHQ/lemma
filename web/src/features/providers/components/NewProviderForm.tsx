import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ProviderKind } from "@/gen/lemma/v1/provider_pb";
import { errorText } from "@/data/rpc/errors";

import { ApiKeyInput } from "./ApiKeyInput";

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
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);

    const handleKindChange = (value: string | null) => {
        const option = KIND_OPTIONS.find((o) => o.value === value);
        if (option === undefined) {
            return;
        }
        setKind(option.kind);
    };

    const handleSave = async () => {
        const trimmedIdentifier = identifier.trim();
        if (!/^[\u0020-\u007E]+$/u.test(trimmedIdentifier)) {
            setFailed(t("providers.identifierInvalid"));
            return;
        }
        if (baseUrl.trim() === "") {
            setFailed(t("errors.providerFieldsRequired"));
            return;
        }
        setBusy(true);
        setFailed(null);
        try {
            await onSave({
                kind,
                identifier: trimmedIdentifier,
                name: name.trim() === "" ? trimmedIdentifier : name.trim(),
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
        <div className="max-w-md px-8 py-6">
            <FieldGroup>
                <h2 className="text-base font-semibold">
                    {t("providers.newProvider")}
                </h2>
                <Field>
                    <FieldLabel htmlFor="np-kind">
                        {requiredMark} {t("providers.type")}
                    </FieldLabel>
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
                </Field>
                <Field>
                    <FieldLabel htmlFor="np-identifier">
                        {requiredMark} {t("providers.identifier")}
                    </FieldLabel>
                    <Input
                        id="np-identifier"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={t("providers.identifierPlaceholder")}
                        required
                    />
                    <FieldDescription>
                        {t("providers.identifierHint")}
                    </FieldDescription>
                </Field>
                <Field>
                    <FieldLabel htmlFor="np-name">
                        {t("providers.name")}
                    </FieldLabel>
                    <Input
                        id="np-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("providers.namePlaceholder")}
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="np-baseurl">
                        {requiredMark} {t("providers.baseUrl")}
                    </FieldLabel>
                    <Input
                        id="np-baseurl"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder={t("providers.baseUrlPlaceholder")}
                        required
                    />
                </Field>
                <Field>
                    <FieldLabel htmlFor="np-apikey">
                        {t("providers.apiKey")}
                    </FieldLabel>
                    <ApiKeyInput
                        id="np-apikey"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={t("providers.apiKeyPlaceholder")}
                    />
                </Field>
                {failed !== null && <FieldError>{failed}</FieldError>}
                <Field orientation="horizontal">
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
                </Field>
            </FieldGroup>
        </div>
    );
}
