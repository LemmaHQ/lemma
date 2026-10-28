import { Button } from "@lemma/ui/components/button";
import { useTranslation } from "react-i18next";

interface SaveBarProps {
    message: string;
    busy: boolean;
    saveDisabled: boolean;
    onSave: () => void;
    onCancel: () => void;
}

/** Bar under a form with pending changes, holding its cancel and save actions. */
export function SaveBar({
    message,
    busy,
    saveDisabled,
    onSave,
    onCancel,
}: SaveBarProps) {
    const { t } = useTranslation();

    return (
        <div className="flex animate-in items-center justify-between gap-3 rounded-lg border bg-muted py-2 pr-2 pl-4 text-sm text-muted-foreground duration-base ease-enter fade-in slide-in-from-top-1">
            <span>{message}</span>
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={onCancel}
                >
                    {t("common.cancel")}
                </Button>
                <Button
                    type="button"
                    disabled={busy || saveDisabled}
                    onClick={onSave}
                >
                    {t("common.save")}
                </Button>
            </div>
        </div>
    );
}
