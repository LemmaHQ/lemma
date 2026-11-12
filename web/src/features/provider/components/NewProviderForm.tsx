import {
    Avatar,
    AvatarFallback,
    BotIcon,
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import {
    API_FORMAT_I18N_KEYS,
    API_FORMATS,
    type ApiFormat,
} from "../api-format";
import { isBaseUrlValid, type ConnectionValues } from "../connection";
import { ConnectionFields } from "./ConnectionFields";
import { SaveBar } from "./SaveBar";

export interface NewProviderData extends ConnectionValues {
    apiFormat: ApiFormat;
    identifier: string;
    name: string;
}

interface NewProviderFormProps {
    onSave: (data: NewProviderData) => Promise<void>;
    onCancel: () => void;
}

/** Blank custom provider page; saving creates the provider. */
export function NewProviderForm({ onSave, onCancel }: NewProviderFormProps) {
    const { t } = useTranslation();
    const [apiFormat, setApiFormat] = useState<ApiFormat>("openai");
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
            setFailed(t("provider.identifierInvalid"));
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
                apiFormat,
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
        <div className="max-w-3xl px-4 py-6 md:px-6">
            <header className="flex items-center gap-3 border-b pb-4">
                <Avatar>
                    <AvatarFallback>
                        {title === "" ? (
                            <BotIcon className="size-4" />
                        ) : (
                            title.charAt(0).toUpperCase()
                        )}
                    </AvatarFallback>
                </Avatar>
                <h2 className="truncate text-title">
                    {title === "" ? t("provider.newProvider") : title}
                </h2>
            </header>

            <FieldGroup className="mt-6">
                <Field orientation="responsive">
                    <FieldContent>
                        <FieldLabel htmlFor="provider-api-format">
                            {t("provider.apiFormat")}
                        </FieldLabel>
                        <FieldDescription>
                            {t("provider.apiFormatDesc")}
                        </FieldDescription>
                    </FieldContent>
                    <Select
                        value={apiFormat}
                        onValueChange={(value) => {
                            for (const option of API_FORMATS.filter(
                                (format) => format === value,
                            )) {
                                setApiFormat(option);
                            }
                        }}
                    >
                        <SelectTrigger
                            id="provider-api-format"
                            className="@md/field-group:shrink-0 @md/field-group:basis-80"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {API_FORMATS.map((format) => (
                                <SelectItem key={format} value={format}>
                                    {t(API_FORMAT_I18N_KEYS[format])}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field orientation="responsive">
                    <FieldContent>
                        <FieldLabel htmlFor="provider-identifier">
                            {t("provider.identifier")}
                        </FieldLabel>
                        <FieldDescription>
                            {t("provider.identifierHint")}
                        </FieldDescription>
                    </FieldContent>
                    <Input
                        id="provider-identifier"
                        className="@md/field-group:shrink-0 @md/field-group:basis-80"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={t("provider.identifierPlaceholder")}
                        required
                    />
                </Field>
                <Field orientation="responsive">
                    <FieldContent>
                        <FieldLabel htmlFor="provider-name">
                            {t("provider.name")}
                        </FieldLabel>
                        <FieldDescription>
                            {t("provider.nameDesc")}
                        </FieldDescription>
                    </FieldContent>
                    <Input
                        id="provider-name"
                        className="@md/field-group:shrink-0 @md/field-group:basis-80"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("provider.namePlaceholder")}
                    />
                </Field>
                <ConnectionFields
                    apiFormat={apiFormat}
                    values={connection}
                    onChange={setConnection}
                />
                {failed !== null && <FieldError>{failed}</FieldError>}
                <SaveBar
                    message={t("provider.newProviderHint")}
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
