import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@lemma/ui/components/field";
import { Input } from "@lemma/ui/components/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@lemma/ui/components/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { errorText } from "@/data/rpc/errors";
import { ProviderKind } from "@/gen/lemma/v1/provider_pb";

import { isBaseUrlValid, type ConnectionValues } from "../connection";
import { ConnectionFields } from "./ConnectionFields";
import { SaveBar } from "./SaveBar";

export interface NewProviderData extends ConnectionValues {
    kind: ProviderKind;
    identifier: string;
    name: string;
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

/** Blank provider page; saving creates the provider. */
export function NewProviderForm({ onSave, onCancel }: NewProviderFormProps) {
    const { t } = useTranslation();
    const [kind, setKind] = useState<ProviderKind>(ProviderKind.OPENAI);
    const [identifier, setIdentifier] = useState("");
    const [name, setName] = useState("");
    const [connection, setConnection] = useState<ConnectionValues>({
        apiKey: "",
        baseUrl: "",
        apiPath: "",
    });
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);
    const title = name.trim() === "" ? identifier.trim() : name.trim();

    const handleSave = async () => {
        const trimmedIdentifier = identifier.trim();
        if (!/^[\u0020-\u007E]+$/u.test(trimmedIdentifier)) {
            setFailed(t("providers.identifierInvalid"));
            return;
        }
        if (connection.baseUrl.trim() === "") {
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
                apiKey: connection.apiKey.trim(),
                baseUrl: connection.baseUrl.trim(),
                apiPath: connection.apiPath.trim(),
            });
        } catch (e) {
            setFailed(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="max-w-3xl px-8 py-6">
            <header className="flex items-center gap-3 border-b pb-4">
                <Avatar>
                    <AvatarFallback>
                        {title === "" ? "?" : title.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <h2 className="truncate text-base font-medium">
                    {title === "" ? t("providers.newProvider") : title}
                </h2>
            </header>

            <FieldGroup className="mt-6">
                <Field orientation="responsive">
                    <FieldContent>
                        <FieldLabel htmlFor="provider-kind">
                            {t("providers.type")}
                        </FieldLabel>
                        <FieldDescription>
                            {t("providers.typeDesc")}
                        </FieldDescription>
                    </FieldContent>
                    <Select
                        value={KIND_OPTIONS.find((o) => o.kind === kind)?.value}
                        onValueChange={(value) => {
                            const option = KIND_OPTIONS.find(
                                (o) => o.value === value,
                            );
                            if (option !== undefined) {
                                setKind(option.kind);
                            }
                        }}
                    >
                        <SelectTrigger
                            id="provider-kind"
                            className="@md/field-group:shrink-0 @md/field-group:basis-80"
                        >
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
                <Field orientation="responsive">
                    <FieldContent>
                        <FieldLabel htmlFor="provider-identifier">
                            {t("providers.identifier")}
                        </FieldLabel>
                        <FieldDescription>
                            {t("providers.identifierHint")}
                        </FieldDescription>
                    </FieldContent>
                    <Input
                        id="provider-identifier"
                        className="@md/field-group:shrink-0 @md/field-group:basis-80"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={t("providers.identifierPlaceholder")}
                        required
                    />
                </Field>
                <Field orientation="responsive">
                    <FieldContent>
                        <FieldLabel htmlFor="provider-name">
                            {t("providers.name")}
                        </FieldLabel>
                        <FieldDescription>
                            {t("providers.nameDesc")}
                        </FieldDescription>
                    </FieldContent>
                    <Input
                        id="provider-name"
                        className="@md/field-group:shrink-0 @md/field-group:basis-80"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("providers.namePlaceholder")}
                    />
                </Field>
                <ConnectionFields
                    kind={kind}
                    values={connection}
                    onChange={setConnection}
                />
                {failed !== null && <FieldError>{failed}</FieldError>}
                <SaveBar
                    message={t("providers.newProviderHint")}
                    busy={busy}
                    saveDisabled={
                        connection.baseUrl.trim() !== "" &&
                        !isBaseUrlValid(connection.baseUrl)
                    }
                    onSave={() => void handleSave()}
                    onCancel={onCancel}
                />
            </FieldGroup>
        </div>
    );
}
