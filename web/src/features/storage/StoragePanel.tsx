import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useStorageSettings } from "./useStorageSettings";

interface Field {
    id: string;
    label: string;
    desc?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    secret?: boolean;
}

function FieldRow({
    field,
    show,
    onToggleShow,
}: {
    field: Field;
    show: boolean;
    onToggleShow: () => void;
}) {
    return (
        <div className="border-b border-border/60 py-4">
            <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                    <Label htmlFor={field.id}>{field.label}</Label>
                    {field.desc && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {field.desc}
                        </p>
                    )}
                </div>
                <div className="flex w-80 items-center gap-1">
                    <Input
                        id={field.id}
                        type={field.secret && !show ? "password" : "text"}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        placeholder={field.placeholder}
                    />
                    {field.secret && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onToggleShow}
                            aria-label="toggle visibility"
                        >
                            {show ? (
                                <EyeOff className="size-4" />
                            ) : (
                                <Eye className="size-4" />
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

export function StoragePanel() {
    const { t } = useTranslation();
    const {
        endpoint,
        setEndpoint,
        region,
        setRegion,
        bucket,
        setBucket,
        accessKey,
        setAccessKey,
        secretKey,
        setSecretKey,
        configured,
        loaded,
        pending,
        busy,
        error,
        testMsg,
        progress,
        migrating,
        migrateDone,
        runMigration,
        handleSave,
        handleTest,
        handleDelete,
    } = useStorageSettings();
    const [showAccess, setShowAccess] = useState(false);
    const [showSecret, setShowSecret] = useState(false);

    if (!loaded) {
        return (
            <div className="max-w-3xl px-8 py-6 text-sm text-muted-foreground">
                {t("common.loading")}
            </div>
        );
    }

    // Secret fields always load empty: the backend only exposes masked
    // values, and an empty field means "keep the current key".
    const fields: Field[] = [
        {
            id: "endpoint",
            label: t("storage.endpoint"),
            desc: t("storage.endpointDesc"),
            value: endpoint,
            onChange: setEndpoint,
        },
        {
            id: "region",
            label: t("storage.region"),
            value: region,
            onChange: setRegion,
        },
        {
            id: "bucket",
            label: t("storage.bucket"),
            desc: t("storage.bucketDesc"),
            value: bucket,
            onChange: setBucket,
        },
        {
            id: "accessKey",
            label: t("storage.accessKey"),
            value: accessKey,
            onChange: setAccessKey,
            placeholder: configured
                ? t("storage.secretPlaceholder")
                : undefined,
            secret: true,
        },
        {
            id: "secretKey",
            label: t("storage.secretKey"),
            value: secretKey,
            onChange: setSecretKey,
            placeholder: configured
                ? t("storage.secretPlaceholder")
                : undefined,
            secret: true,
        },
    ];

    const pct =
        progress && progress.total > 0
            ? Math.min(100, Math.round((progress.done / progress.total) * 100))
            : 0;

    return (
        <div className="max-w-3xl px-8 py-6">
            <h2 className="text-base font-semibold">{t("storage.title")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
                {t("storage.desc")}
            </p>

            {pending && !migrating && (
                <div className="mt-4 rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning">
                    <span>{t("storage.pendingBanner")}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="ml-3"
                        onClick={() => void runMigration()}
                    >
                        {t("storage.resume")}
                    </Button>
                </div>
            )}

            <div className="mt-4">
                {fields.map((f) => (
                    <FieldRow
                        key={f.id}
                        field={f}
                        show={f.id === "accessKey" ? showAccess : showSecret}
                        onToggleShow={() =>
                            f.id === "accessKey"
                                ? setShowAccess(!showAccess)
                                : setShowSecret(!showSecret)
                        }
                    />
                ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={busy}
                >
                    {t("storage.test")}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={busy}>
                    {t("common.save")}
                </Button>
                {configured && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDelete}
                        disabled={busy}
                    >
                        {t("common.delete")}
                    </Button>
                )}
            </div>

            {(progress || migrating) && (
                <div className="mt-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-accent/60">
                        <div
                            className="h-full bg-foreground transition-all"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {progress
                            ? t("storage.migrateResult", progress)
                            : t("storage.migrating")}
                    </p>
                </div>
            )}
            {migrateDone && (
                <p className="mt-2 text-sm text-success">
                    {t("storage.migrated")}
                </p>
            )}

            {error && <p className="mt-4 text-xs text-destructive">{error}</p>}
            {testMsg && <p className="mt-2 text-xs text-success">{testMsg}</p>}
        </div>
    );
}
