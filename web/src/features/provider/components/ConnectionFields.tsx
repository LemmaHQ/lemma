import {
    ChevronDownIcon,
    ChevronRightIcon,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Input,
    SettingsField,
} from "@lemma/ui";
import { useId, useState } from "react";
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

/** API key, base URL, and collapsible endpoint path overrides of a custom provider. */
export function ConnectionFields({
    apiFormat,
    values,
    onChange,
}: ConnectionFieldsProps) {
    const { t } = useTranslation();
    const baseUrlId = useId();
    const apiPathId = useId();
    const modelsPathId = useId();
    const [pathsOpen, setPathsOpen] = useState(
        values.apiPath !== "" || values.modelsPath !== "",
    );
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
                htmlFor={baseUrlId}
                description={t("provider.baseUrlDesc")}
                error={
                    baseUrlInvalid ? t("provider.baseUrlInvalid") : undefined
                }
            >
                <Input
                    id={baseUrlId}
                    value={values.baseUrl}
                    onChange={(e) =>
                        onChange({ ...values, baseUrl: e.target.value })
                    }
                    placeholder={placeholders.baseUrl}
                    aria-invalid={baseUrlInvalid}
                />
            </SettingsField>
            <div className="py-2">
                <Collapsible open={pathsOpen} onOpenChange={setPathsOpen}>
                    <CollapsibleTrigger
                        render={
                            <button
                                type="button"
                                aria-label={t("provider.customPaths")}
                                className="-ml-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-small text-muted-foreground transition-colors duration-base hover:bg-selected hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                            />
                        }
                    >
                        {pathsOpen ? (
                            <ChevronDownIcon className="size-3.5 shrink-0" />
                        ) : (
                            <ChevronRightIcon className="size-3.5 shrink-0" />
                        )}
                        <span>{t("provider.customPaths")}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="flex flex-col divide-y divide-border/60 pt-1">
                            <SettingsField
                                label={t("provider.apiPath")}
                                htmlFor={apiPathId}
                                description={
                                    apiFormat === "gemini"
                                        ? t("provider.apiPathDescGemini")
                                        : t("provider.apiPathDesc")
                                }
                            >
                                <Input
                                    id={apiPathId}
                                    value={values.apiPath}
                                    onChange={(e) =>
                                        onChange({
                                            ...values,
                                            apiPath: e.target.value,
                                        })
                                    }
                                    placeholder={placeholders.apiPath}
                                />
                            </SettingsField>
                            <SettingsField
                                label={t("provider.modelsPath")}
                                htmlFor={modelsPathId}
                                description={t("provider.modelsPathDesc")}
                            >
                                <Input
                                    id={modelsPathId}
                                    value={values.modelsPath}
                                    onChange={(e) =>
                                        onChange({
                                            ...values,
                                            modelsPath: e.target.value,
                                        })
                                    }
                                    placeholder={placeholders.modelsPath}
                                />
                            </SettingsField>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </>
    );
}
