import { Input, SettingsField } from "@lemma/ui";
import { useTranslation } from "react-i18next";

import type { ApiFormat } from "../api-format";
import {
    CONNECTION_PLACEHOLDERS,
    isBaseUrlValid,
    type ConnectionValues,
} from "../connection";
import { ApiKeyField } from "./ApiKeyField";

interface ConnectionFieldsProps {
    apiFormat: ApiFormat;
    values: ConnectionValues;
    onChange: (values: ConnectionValues) => void;
}

/** API key, base URL, and request path fields of a custom provider's connection section. */
export function ConnectionFields({
    apiFormat,
    values,
    onChange,
}: ConnectionFieldsProps) {
    const { t } = useTranslation();
    const placeholders = CONNECTION_PLACEHOLDERS[apiFormat];
    const baseUrlInvalid =
        values.baseUrl.trim() !== "" && !isBaseUrlValid(values.baseUrl);

    return (
        <>
            <ApiKeyField
                value={values.apiKey}
                onChange={(apiKey) => onChange({ ...values, apiKey })}
            />
            <SettingsField
                label={t("provider.baseUrl")}
                htmlFor="provider-base-url"
                description={t("provider.baseUrlDesc")}
                error={
                    baseUrlInvalid ? t("provider.baseUrlInvalid") : undefined
                }
            >
                <Input
                    id="provider-base-url"
                    value={values.baseUrl}
                    onChange={(e) =>
                        onChange({ ...values, baseUrl: e.target.value })
                    }
                    placeholder={placeholders.baseUrl}
                    aria-invalid={baseUrlInvalid}
                />
            </SettingsField>
            <SettingsField
                label={t("provider.apiPath")}
                htmlFor="provider-api-path"
                description={
                    apiFormat === "gemini"
                        ? t("provider.apiPathDescGemini")
                        : t("provider.apiPathDesc")
                }
            >
                <Input
                    id="provider-api-path"
                    value={values.apiPath}
                    onChange={(e) =>
                        onChange({ ...values, apiPath: e.target.value })
                    }
                    placeholder={placeholders.apiPath}
                />
            </SettingsField>
        </>
    );
}
