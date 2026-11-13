import {
    Avatar,
    AvatarFallback,
    BotIcon,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SettingsField,
    SettingsPage,
    SettingsSection,
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
        <SettingsPage
            title={title === "" ? t("provider.newProvider") : title}
            media={
                <Avatar>
                    <AvatarFallback>
                        {title === "" ? (
                            <BotIcon className="size-4" />
                        ) : (
                            title.charAt(0).toUpperCase()
                        )}
                    </AvatarFallback>
                </Avatar>
            }
        >
            <SettingsSection title={t("provider.basics")}>
                <SettingsField
                    label={t("provider.apiFormat")}
                    htmlFor="provider-api-format"
                    description={t("provider.apiFormatDesc")}
                >
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
                            className="w-full"
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
                </SettingsField>
                <SettingsField
                    label={t("provider.identifier")}
                    htmlFor="provider-identifier"
                    description={t("provider.identifierHint")}
                >
                    <Input
                        id="provider-identifier"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={t("provider.identifierPlaceholder")}
                        required
                    />
                </SettingsField>
                <SettingsField
                    label={t("provider.name")}
                    htmlFor="provider-name"
                    description={t("provider.nameDesc")}
                >
                    <Input
                        id="provider-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("provider.namePlaceholder")}
                    />
                </SettingsField>
            </SettingsSection>
            <SettingsSection
                title={t("provider.connection")}
                error={failed}
                footer={
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
                }
            >
                <ConnectionFields
                    apiFormat={apiFormat}
                    values={connection}
                    onChange={setConnection}
                />
            </SettingsSection>
        </SettingsPage>
    );
}
