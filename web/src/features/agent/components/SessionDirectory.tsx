import {
    Button,
    toast,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    XIcon,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";
import { getPlatform } from "@/platform/platform";

interface SessionDirectoryProps {
    value: string | null;
    onChange?: (directory: string | null) => void;
}

export function SessionDirectory({ value, onChange }: SessionDirectoryProps) {
    const { t } = useTranslation();
    const [picking, setPicking] = useState(false);
    const picker = getPlatform().directoryPicker;

    if (picker === null || onChange === undefined) {
        if (value === null) {
            return null;
        }
        return (
            <div className="flex min-w-0 items-center">
                <span className="sr-only">{t("session.directoryLabel")}</span>
                <span className="min-w-0 truncate px-2 text-caption text-muted-foreground">
                    {value}
                </span>
            </div>
        );
    }

    const choose = async () => {
        setPicking(true);
        try {
            const directory = await picker.pick();
            if (directory !== null) {
                onChange(directory);
            }
        } catch (e) {
            toast.error(errorText(e, t));
        } finally {
            setPicking(false);
        }
    };

    if (value === null) {
        return (
            <div>
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    loading={picking}
                    onClick={() => void choose()}
                >
                    {t("session.chooseFolder")}
                </Button>
            </div>
        );
    }

    return (
        <div className="flex min-w-0 items-center gap-1">
            <span className="sr-only">{t("session.directoryLabel")}</span>
            <Button
                type="button"
                variant="ghost"
                size="xs"
                className="min-w-0 flex-1 justify-start"
                loading={picking}
                onClick={() => void choose()}
            >
                <span className="truncate">{value}</span>
            </Button>
            <Tooltip>
                <TooltipTrigger
                    render={
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("session.clearFolder")}
                            disabled={picking}
                            onClick={() => onChange(null)}
                        />
                    }
                >
                    <XIcon />
                </TooltipTrigger>
                <TooltipContent>{t("session.clearFolder")}</TooltipContent>
            </Tooltip>
        </div>
    );
}
