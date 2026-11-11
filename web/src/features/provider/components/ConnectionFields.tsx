import { Input, PasswordInput, SettingsField } from "@lemma/ui";
import { useTranslation } from "react-i18next";

import {
    CONNECTION_PLACEHOLDERS,
    isBaseUrlValid,
    type ConnectionValues,
} from "../connection";
import type { ProviderKind } from "../store";

interface ConnectionFieldsProps {
    kind: ProviderKind;
    values: ConnectionValues;
    onChange: (values: ConnectionValues) => void;
}

/** API key, base URL, and request path fields of a provider's connection section. */
export function ConnectionFields({
    kind,
    values,
    onChange,
}: ConnectionFieldsProps) {
    const { t } = useTranslation();
    const placeholders = CONNECTION_PLACEHOLDERS[kind];
    const baseUrlInvalid =
        values.baseUrl.trim() !== "" && !isBaseUrlValid(values.baseUrl);

    return (
        <>
            <SettingsField
                label={t("provider.apiKey")}
                htmlFor="provider-api-key"
                description={t("provider.apiKeyDesc")}
            >
                <PasswordInput
                    showLabel={t("passwordInput.show")}
                    hideLabel={t("passwordInput.hide")}
                    id="provider-api-key"
                    value={values.apiKey}
                    onChange={(e) =>
                        onChange({ ...values, apiKey: e.target.value })
                    }
                    placeholder={t("provider.apiKeyPlaceholder")}
                />
            </SettingsField>
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
                    kind === "gemini"
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
