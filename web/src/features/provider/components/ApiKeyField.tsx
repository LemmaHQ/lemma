import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    PasswordInput,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

interface ApiKeyFieldProps {
    value: string;
    onChange: (value: string) => void;
}

export function ApiKeyField({ value, onChange }: ApiKeyFieldProps) {
    const { t } = useTranslation();
    return (
        <Field orientation="responsive">
            <FieldContent>
                <FieldLabel htmlFor="provider-api-key">
                    {t("provider.apiKey")}
                </FieldLabel>
                <FieldDescription>{t("provider.apiKeyDesc")}</FieldDescription>
            </FieldContent>
            <PasswordInput
                showLabel={t("passwordInput.show")}
                hideLabel={t("passwordInput.hide")}
                id="provider-api-key"
                className="@md/field-group:shrink-0 @md/field-group:basis-80"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={t("provider.apiKeyPlaceholder")}
                autoComplete="off"
            />
        </Field>
    );
}
