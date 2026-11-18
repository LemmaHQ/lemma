import type { ReactNode } from "react";

import { FieldDescription, FieldError } from "#primitives/field";
import { Label } from "#primitives/label";
import { cn } from "#lib/cn";

/**
 * One setting row with a wide control beside `label` and `description`.
 * `htmlFor` binds the label to the control with that id. `error` replaces the description and styles the field invalid.
 */
export function SettingsField({
    label,
    htmlFor,
    description,
    error,
    align = "center",
    children,
}: {
    label: ReactNode;
    htmlFor?: string | undefined;
    description?: ReactNode;
    error?: ReactNode;
    align?: "center" | "top" | undefined;
    children: ReactNode;
}) {
    const invalid = error !== undefined && error !== null;

    return (
        <div
            data-slot="settings-field"
            data-invalid={invalid ? "" : undefined}
            className={cn(
                "group/settings-field grid gap-x-6 gap-y-2 py-3.5",
                align === "top"
                    ? "@md/settings-section:grid-cols-[minmax(0,1fr)_auto] @md/settings-section:items-start"
                    : "@md/settings-section:grid-cols-[minmax(0,1fr)_min(20rem,52%)] @md/settings-section:items-center",
            )}
        >
            <div className="flex min-w-0 flex-col gap-0.5 group-data-invalid/settings-field:text-destructive">
                {htmlFor === undefined ? (
                    <div className="text-body font-medium">{label}</div>
                ) : (
                    <Label htmlFor={htmlFor}>{label}</Label>
                )}
                {invalid ? (
                    <FieldError>{error}</FieldError>
                ) : (
                    description !== undefined && (
                        <FieldDescription className="text-balance">
                            {description}
                        </FieldDescription>
                    )
                )}
            </div>
            <div className="flex min-w-0 items-center gap-2 @md/settings-section:justify-end">
                {children}
            </div>
        </div>
    );
}

/** One hairline row of a section: `label` with its compact controls or actions at the end. */
export function SettingsRow({
    label,
    children,
}: {
    label: ReactNode;
    children: ReactNode;
}) {
    return (
        <div
            data-slot="settings-row"
            className="group/settings-row flex min-h-9 items-center gap-3.5 py-2"
        >
            <div className="min-w-0 flex-1 text-body font-medium wrap-anywhere">
                {label}
            </div>
            <div className="flex shrink-0 items-center gap-2">{children}</div>
        </div>
    );
}
