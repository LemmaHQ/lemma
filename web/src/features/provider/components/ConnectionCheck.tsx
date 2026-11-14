import {
    Button,
    CheckIcon,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SettingsField,
    XIcon,
} from "@lemma/ui";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import type { ApiFormat } from "../api-format";

type CheckResult =
    | { status: "checking" }
    | { status: "passed" }
    | { status: "failed"; message: string };

type CheckStatus = CheckResult["status"] | "idle";

/** The connection a check runs against; a result stays visible only while it matches. */
export interface ConnectionTarget {
    apiKey: string;
    baseUrl?: string | undefined;
    apiPath?: string | undefined;
    apiFormat?: ApiFormat | undefined;
}

type Snapshot = ConnectionTarget & { model: string };

type CheckedResult = CheckResult & { snapshot: Snapshot };

interface ConnectionCheckProps {
    models: string[];
    /** Identifies the connection being checked; a result stays visible only while it matches. */
    target: ConnectionTarget;
    disabled: boolean;
    /** Resolves to the upstream failure message, empty when the model answered. */
    onCheck: (model: string) => Promise<string>;
}

const STATUS_TONES = {
    idle: "default",
    checking: "default",
    passed: "success",
    failed: "destructive",
} satisfies Record<CheckStatus, "default" | "success" | "destructive">;

const STATUS_ICONS: Partial<Record<CheckStatus, ReactNode>> = {
    passed: <CheckIcon animate />,
    failed: <XIcon animate />,
};

const matchesSnapshot = (
    snapshot: Snapshot,
    target: ConnectionTarget,
    model: string | undefined,
): boolean =>
    snapshot.apiKey === target.apiKey &&
    snapshot.baseUrl === target.baseUrl &&
    snapshot.apiPath === target.apiPath &&
    snapshot.apiFormat === target.apiFormat &&
    snapshot.model === model;

/** Settings row that sends a test request for one model through the connection. */
export function ConnectionCheck({
    models,
    target,
    disabled,
    onCheck,
}: ConnectionCheckProps) {
    const { t } = useTranslation();
    const [picked, setPicked] = useState<string | null>(null);
    const [result, setResult] = useState<CheckedResult | null>(null);
    const model =
        picked !== null && models.includes(picked) ? picked : models.at(0);
    const current =
        result !== null && matchesSnapshot(result.snapshot, target, model)
            ? result
            : null;
    const status = current?.status ?? "idle";
    const runnable = model !== undefined && !disabled;

    const check = async (checked: string) => {
        const snapshot = { ...target, model: checked };
        setResult({ snapshot, status: "checking" });
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
        setResult((r) => {
            if (r === null || !matchesSnapshot(r.snapshot, target, checked)) {
                return r;
            }
            if (next.status === "failed") {
                return { snapshot, status: "failed", message: next.message };
            }
            return { snapshot, status: next.status };
        });
    };

    return (
        <SettingsField
            label={t("provider.check")}
            htmlFor="provider-check-model"
            description={
                status === "passed"
                    ? t("provider.checkPassed")
                    : t("provider.checkDesc")
            }
            error={current?.status === "failed" ? current.message : undefined}
        >
            <Select
                value={model ?? null}
                onValueChange={(value) => setPicked(value)}
                disabled={models.length === 0}
            >
                <SelectTrigger
                    id="provider-check-model"
                    className="min-w-0 flex-1"
                >
                    <SelectValue placeholder={t("provider.checkNoModels")} />
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
        </SettingsField>
    );
}
