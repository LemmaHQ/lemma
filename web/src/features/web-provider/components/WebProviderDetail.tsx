import { Button, PasswordInput, Switch, toast } from "@lemma/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import type { WebProvider, WebProviderKind, WebProviderPatch } from "../store";

const HOSTS: Partial<Record<WebProviderKind, string>> = {
    exa: "api.exa.ai",
    deepseek: "api.deepseek.com",
};

interface WebProviderDetailProps {
    provider: WebProvider;
    onUpdate: (patch: WebProviderPatch) => Promise<void>;
}

/** One backend row inside the web backends settings section. */
export function WebProviderDetail({
    provider,
    onUpdate,
}: WebProviderDetailProps) {
    const { t } = useTranslation();
    const [draftKey, setDraftKey] = useState(provider.apiKey);
    const [pending, setPending] = useState<"save" | "clear" | "toggle" | null>(
        null,
    );
    const nameId = useId();
    const inputId = useId();
    const trimmedKey = draftKey.trim();
    const busy = pending !== null;
    const canSave = trimmedKey !== provider.apiKey && trimmedKey !== "";
    const switchDisabled =
        busy ||
        (provider.kind !== "native" &&
            provider.apiKey === "" &&
            trimmedKey === "");
    const host = HOSTS[provider.kind];

    const runUpdate = async (
        action: "save" | "clear" | "toggle",
        patch: WebProviderPatch,
        nextDraft?: string,
    ) => {
        setPending(action);
        try {
            await onUpdate(patch);
            if (nextDraft !== undefined) {
                setDraftKey(nextDraft);
            }
        } catch (e) {
            toast.error(errorText(e, t));
        } finally {
            setPending(null);
        }
    };

    const toggle = (enabled: boolean) => {
        const includeDraft =
            enabled && provider.kind !== "native" && provider.apiKey === "";
        const patch: WebProviderPatch = includeDraft
            ? { apiKey: trimmedKey, enabled }
            : { enabled };
        void runUpdate("toggle", patch, includeDraft ? trimmedKey : undefined);
    };

    return (
        <fieldset
            aria-labelledby={nameId}
            data-slot="web-backend-row"
            className="flex flex-col gap-2.5 py-3.5 first:pt-0"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span
                            id={nameId}
                            className="text-body font-medium text-foreground"
                        >
                            {provider.name}
                        </span>
                        {host === undefined ? (
                            <span className="text-caption text-muted-foreground">
                                {t("provider.webCapFetchOnly")}
                            </span>
                        ) : (
                            <span className="text-caption text-muted-foreground">
                                {t("provider.webCapBoth")}
                                {" · "}
                                <span className="font-mono">{host}</span>
                            </span>
                        )}
                    </div>
                    {provider.kind === "native" && (
                        <p className="text-small text-muted-foreground">
                            {t("provider.webNativeDesc")}
                        </p>
                    )}
                </div>
                <Switch
                    checked={provider.enabled}
                    disabled={switchDisabled}
                    onCheckedChange={toggle}
                    aria-label={t("provider.enableWebProvider", {
                        name: provider.name,
                    })}
                />
            </div>
            {provider.kind === "native" ? (
                <p className="text-caption text-muted-foreground">
                    {t("provider.webLocalNoKey")}
                </p>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                        <PasswordInput
                            showLabel={t("passwordInput.show")}
                            hideLabel={t("passwordInput.hide")}
                            id={inputId}
                            aria-label={t("provider.apiKey")}
                            value={draftKey}
                            onChange={(event) =>
                                setDraftKey(event.target.value)
                            }
                            placeholder={t("provider.apiKeyPlaceholder")}
                            autoComplete="off"
                        />
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        loading={pending === "save"}
                        disabled={busy || !canSave}
                        onClick={() =>
                            void runUpdate(
                                "save",
                                { apiKey: trimmedKey },
                                trimmedKey,
                            )
                        }
                    >
                        {t("common.save")}
                    </Button>
                    {provider.apiKey !== "" && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            loading={pending === "clear"}
                            disabled={busy}
                            onClick={() =>
                                void runUpdate("clear", { apiKey: "" }, "")
                            }
                        >
                            {t("provider.clearKey")}
                        </Button>
                    )}
                </div>
            )}
        </fieldset>
    );
}
