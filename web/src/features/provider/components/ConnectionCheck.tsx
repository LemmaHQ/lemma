import {
    Button,
    CheckIcon,
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldLabel,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    XIcon,
} from "@lemma/ui";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

type CheckResult =
    | { status: "checking" }
    | { status: "passed" }
    | { status: "failed"; message: string };

type CheckStatus = CheckResult["status"] | "idle";

interface ConnectionCheckProps {
    models: string[];
    /** Identifies the connection being checked; a result stays visible only while it matches. */
    target: string;
    disabled: boolean;
    /** Resolves to the upstream failure message, empty when the model answered. */
    onCheck: (model: string) => Promise<string>;
}

const STATUS_TONES: Record<CheckStatus, "default" | "success" | "destructive"> =
    {
        idle: "default",
        checking: "default",
        passed: "success",
        failed: "destructive",
    };

const STATUS_ICONS: Partial<Record<CheckStatus, ReactNode>> = {
    passed: <CheckIcon animate />,
    failed: <XIcon animate />,
};

/** Settings row that sends a test request for one model through the connection. */
export function ConnectionCheck({
    models,
    target,
    disabled,
    onCheck,
}: ConnectionCheckProps) {
    const { t } = useTranslation();
    const [picked, setPicked] = useState<string | null>(null);
    const [result, setResult] = useState<
        (CheckResult & { key: string }) | null
    >(null);
    const model =
        picked !== null && models.includes(picked) ? picked : models.at(0);
    const key = `${target}\n${model ?? ""}`;
    const current = result?.key === key ? result : null;
    const status = current?.status ?? "idle";
    const runnable = model !== undefined && !disabled;

    const check = async (checked: string) => {
        setResult({ key, status: "checking" });
        let next: CheckResult;
        try {
            const message = await onCheck(checked);
            next =
                message === ""
                    ? { status: "passed" }
                    : { status: "failed", message };
        } catch (e) {
            next = { status: "failed", message: errorText(e, t) };
        }
        setResult((r) => (r?.key === key ? { key, ...next } : r));
    };

    return (
        <Field orientation="responsive" data-invalid={status === "failed"}>
            <FieldContent>
                <FieldLabel htmlFor="provider-check-model">
                    {t("provider.check")}
                </FieldLabel>
                {current?.status === "failed" ? (
                    <FieldError>{current.message}</FieldError>
                ) : (
                    <FieldDescription>
                        {status === "passed"
                            ? t("provider.checkPassed")
                            : t("provider.checkDesc")}
                    </FieldDescription>
                )}
            </FieldContent>
            <div className="flex gap-2 @md/field-group:shrink-0 @md/field-group:basis-80">
                <Select
                    value={model ?? null}
                    onValueChange={(value) => setPicked(value)}
                    disabled={models.length === 0}
                >
                    <SelectTrigger
                        id="provider-check-model"
                        className="min-w-0 flex-1"
                    >
                        <SelectValue
                            placeholder={t("provider.checkNoModels")}
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {models.map((m) => (
                            <SelectItem key={m} value={m}>
                                {m}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    type="button"
                    variant="outline"
                    tone={STATUS_TONES[status]}
                    loading={status === "checking"}
                    disabled={!runnable}
                    onClick={runnable ? () => void check(model) : undefined}
                >
                    {STATUS_ICONS[status]}
                    {t("provider.checkAction")}
                </Button>
            </div>
        </Field>
    );
}
