import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldLabel,
    Input,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

import {
    CONNECTION_PLACEHOLDERS,
    isBaseUrlValid,
    type ConnectionValues,
} from "../connection";
import type { ApiFormat } from "../api-format";
import { ApiKeyField } from "./ApiKeyField";

interface ConnectionFieldsProps {
    apiFormat: ApiFormat;
    values: ConnectionValues;
    onChange: (values: ConnectionValues) => void;
}

/** API key, base URL, and request path rows of a custom provider page. */
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
                        {apiFormat === "gemini"
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
