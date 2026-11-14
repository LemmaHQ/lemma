import {
    Button,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SettingsField,
    SettingsPage,
    SettingsSectionCompact,
} from "@lemma/ui";
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import {
    API_FORMAT_I18N_KEYS,
    API_FORMATS,
    type ApiFormat,
} from "../api-format";
import { isBaseUrlValid, type ConnectionValues } from "../connection";
import { ConnectionFields } from "./ConnectionFields";

export interface NewProviderData extends ConnectionValues {
    apiFormat: ApiFormat;
    identifier: string;
    name: string;
}

interface NewProviderFormProps {
    index?: ReactNode;
    onSave: (data: NewProviderData) => Promise<void>;
    onCancel: () => void;
}

/** Blank custom provider page; saving creates the provider. */
export function NewProviderForm({
    index,
    onSave,
    onCancel,
}: NewProviderFormProps) {
    const { t } = useTranslation();
    const nameId = useId();
    const identifierId = useId();
    const formatId = useId();
    const [apiFormat, setApiFormat] = useState<ApiFormat>("openai");
    const [identifier, setIdentifier] = useState("");
    const [name, setName] = useState("");
    const [connection, setConnection] = useState<ConnectionValues>({
        apiKey: "",
        baseUrl: "",
        apiPath: "",
        modelsPath: "",
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
                modelsPath: connection.modelsPath.trim(),
            });
        } catch (e) {
            setFailed(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    return (
        <SettingsPage
            index={index}
            title={title === "" ? t("provider.newProvider") : title}
            badge={t("provider.newProviderHint")}
        >
            <SettingsSectionCompact
                error={failed}
                footer={
                    <div className="flex items-center gap-2.5 pt-2">
                        <Button
                            type="button"
                            disabled={
                                busy ||
                                (connection.baseUrl.trim() !== "" &&
                                    !isBaseUrlValid(connection.baseUrl))
                            }
                            onClick={() => void handleSave()}
                        >
                            {t("provider.createAction")}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={onCancel}
                        >
                            {t("common.cancel")}
                        </Button>
                    </div>
                }
            >
                <SettingsField
                    label={t("provider.name")}
                    htmlFor={nameId}
                    description={t("provider.nameDesc")}
                >
                    <Input
                        id={nameId}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("provider.namePlaceholder")}
                    />
                </SettingsField>
                <SettingsField
                    label={t("provider.identifier")}
                    htmlFor={identifierId}
                    description={t("provider.identifierHint")}
                >
                    <Input
                        id={identifierId}
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={t("provider.identifierPlaceholder")}
                        required
                    />
                </SettingsField>
                <SettingsField
                    label={t("provider.apiFormat")}
                    htmlFor={formatId}
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
                        <SelectTrigger id={formatId} className="w-full">
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
                <ConnectionFields
                    apiFormat={apiFormat}
                    values={connection}
                    onChange={setConnection}
                />
            </SettingsSectionCompact>
        </SettingsPage>
    );
}
