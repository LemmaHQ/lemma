import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldLabel,
    Input,
    PasswordInput,
} from "@lemma/ui";
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

/** API key, base URL, and request path rows of a provider page. */
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
            <Field orientation="responsive">
                <FieldContent>
                    <FieldLabel htmlFor="provider-api-key">
                        {t("provider.apiKey")}
                    </FieldLabel>
                    <FieldDescription>
                        {t("provider.apiKeyDesc")}
                    </FieldDescription>
                </FieldContent>
                <PasswordInput
                    showLabel={t("passwordInput.show")}
                    hideLabel={t("passwordInput.hide")}
                    id="provider-api-key"
                    className="@md/field-group:shrink-0 @md/field-group:basis-80"
                    value={values.apiKey}
                    onChange={(e) =>
                        onChange({ ...values, apiKey: e.target.value })
                    }
                    placeholder={t("provider.apiKeyPlaceholder")}
                />
            </Field>
            <Field orientation="responsive" data-invalid={baseUrlInvalid}>
                <FieldContent>
                    <FieldLabel htmlFor="provider-base-url">
                        {t("provider.baseUrl")}
                    </FieldLabel>
                    {baseUrlInvalid ? (
                        <FieldError>{t("provider.baseUrlInvalid")}</FieldError>
                    ) : (
                        <FieldDescription>
                            {t("provider.baseUrlDesc")}
                        </FieldDescription>
                    )}
                </FieldContent>
                <Input
                    id="provider-base-url"
                    className="@md/field-group:shrink-0 @md/field-group:basis-80"
                    value={values.baseUrl}
                    onChange={(e) =>
                        onChange({ ...values, baseUrl: e.target.value })
                    }
                    placeholder={placeholders.baseUrl}
                    aria-invalid={baseUrlInvalid}
                />
            </Field>
            <Field orientation="responsive">
                <FieldContent>
                    <FieldLabel htmlFor="provider-api-path">
                        {t("provider.apiPath")}
                    </FieldLabel>
                    <FieldDescription>
                        {kind === "gemini"
                            ? t("provider.apiPathDescGemini")
                            : t("provider.apiPathDesc")}
                    </FieldDescription>
                </FieldContent>
                <Input
                    id="provider-api-path"
                    className="@md/field-group:shrink-0 @md/field-group:basis-80"
                    value={values.apiPath}
                    onChange={(e) =>
                        onChange({ ...values, apiPath: e.target.value })
                    }
                    placeholder={placeholders.apiPath}
                />
            </Field>
        </>
    );
}
