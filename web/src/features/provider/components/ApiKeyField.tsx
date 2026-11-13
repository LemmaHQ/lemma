import { PasswordInput, SettingsField } from "@lemma/ui";
import { useTranslation } from "react-i18next";

interface ApiKeyFieldProps {
    value: string;
    description?: string | undefined;
    onChange: (value: string) => void;
}

export function ApiKeyField({
    value,
    description,
    onChange,
}: ApiKeyFieldProps) {
    const { t } = useTranslation();
    return (
        <SettingsField
            label={t("provider.apiKey")}
            htmlFor="provider-api-key"
            description={description ?? t("provider.apiKeyDesc")}
        >
            <PasswordInput
                showLabel={t("passwordInput.show")}
                hideLabel={t("passwordInput.hide")}
                id="provider-api-key"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={t("provider.apiKeyPlaceholder")}
                autoComplete="off"
            />
        </SettingsField>
    );
}
