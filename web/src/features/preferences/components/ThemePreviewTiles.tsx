import { cn } from "@lemma/ui";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import type { ThemePreference } from "../theme";

const OPTIONS = [
    { value: "light", label: "theme.light" },
    { value: "dark", label: "theme.dark" },
    { value: "system", label: "theme.system" },
] as const;

function PreviewSurface({ theme }: { theme: "light" | "dark" }) {
    return (
        <span
            data-theme-preview={theme}
            className="flex size-full overflow-hidden bg-background text-foreground"
        >
            <span className="flex w-6 shrink-0 flex-col gap-1 border-r border-border bg-sidebar p-1.5">
                <span className="h-1 w-full rounded-full bg-brand" />
                <span className="h-1 w-3/4 rounded-full bg-muted-foreground/30" />
                <span className="h-1 w-4/5 rounded-full bg-muted-foreground/20" />
            </span>
            <span className="flex flex-1 flex-col gap-1.5 p-2">
                <span className="h-1.5 w-8 rounded-full bg-foreground/25" />
                <span className="h-1 w-full rounded-full bg-muted-foreground/25" />
                <span className="h-1 w-3/4 rounded-full bg-muted-foreground/20" />
            </span>
        </span>
    );
}

/** The theme choice as a group of three 92×58px radio tiles previewing the light, dark, and system appearance. */
export function ThemePreviewTiles({
    value,
    onValueChange,
}: {
    value: ThemePreference;
    onValueChange: (value: ThemePreference) => void;
}) {
    const { t } = useTranslation();
    const name = useId();

    return (
        <fieldset className="flex flex-wrap gap-3.5 sm:flex-nowrap">
            <legend className="sr-only">{t("settings.themeLabel")}</legend>
            {OPTIONS.map((option) => {
                const checked = value === option.value;
                return (
                    <label
                        key={option.value}
                        className="group flex cursor-pointer flex-col items-start gap-1.5"
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={checked}
                            onChange={() => onValueChange(option.value)}
                            className="peer sr-only"
                        />
                        <span
                            aria-hidden="true"
                            className={cn(
                                "relative flex h-14.5 w-23 overflow-hidden rounded-md transition-shadow duration-base peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                                checked
                                    ? "ring-2 ring-foreground"
                                    : "ring-1 ring-input group-hover:ring-muted-foreground",
                            )}
                        >
                            {option.value === "system" ? (
                                <>
                                    <span className="h-full w-1/2 overflow-hidden">
                                        <PreviewSurface theme="light" />
                                    </span>
                                    <span className="h-full w-1/2 overflow-hidden border-l border-border">
                                        <PreviewSurface theme="dark" />
                                    </span>
                                </>
                            ) : (
                                <PreviewSurface theme={option.value} />
                            )}
                        </span>
                        <span
                            className={cn(
                                "text-small",
                                checked
                                    ? "font-medium text-foreground"
                                    : "text-muted-foreground",
                            )}
                        >
                            {t(option.label)}
                        </span>
                    </label>
                );
            })}
        </fieldset>
    );
}
