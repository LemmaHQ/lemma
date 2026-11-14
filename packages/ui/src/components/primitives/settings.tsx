import { useId, type ReactNode } from "react";

import { FieldDescription, FieldError } from "#primitives/field";
import { Label } from "#primitives/label";
import { ScrollArea } from "#primitives/scroll-area";
import { cn } from "#lib/cn";

/**
 * A scrolling settings page: one centered 760px column with an optional
 * hairline-separated header when `title`, `media`, or `actions` is provided.
 */
export function SettingsPage({
    title,
    media,
    actions,
    children,
}: {
    title?: ReactNode;
    media?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}) {
    const hasHeader =
        title !== undefined || media !== undefined || actions !== undefined;

    return (
        <ScrollArea className="min-h-0 min-w-0 flex-1">
            <div
                data-slot="settings-page"
                className="mx-auto flex w-full max-w-190 flex-col px-4 pt-12 pb-16 md:px-6"
            >
                {hasHeader && (
                    <header className="mb-4 flex min-h-9 items-center gap-3 border-b border-border pb-4">
                        {media}
                        {title !== undefined && (
                            <h1 className="min-w-0 flex-1 truncate text-display">
                                {title}
                            </h1>
                        )}
                        {actions !== undefined && (
                            <div className="ml-auto flex shrink-0 items-center gap-1">
                                {actions}
                            </div>
                        )}
                    </header>
                )}
                <div className="flex flex-col">{children}</div>
            </div>
        </ScrollArea>
    );
}

/**
 * A cardless group of settings separated by hairlines. When `description` or
 * `meta` is provided, renders a 2-column grid with the description column on
 * the left; otherwise renders a compact subhead above hairline-divided rows.
 */
export function SettingsSection({
    title,
    description,
    meta,
    actions,
    error,
    footer,
    children,
}: {
    title?: ReactNode;
    description?: ReactNode;
    meta?: ReactNode;
    actions?: ReactNode;
    error?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
}) {
    const titleId = useId();
    const hasAside = description !== undefined || meta !== undefined;
    const hasError = error !== undefined && error !== null;

    if (hasAside) {
        return (
            <section
                data-slot="settings-section"
                aria-labelledby={title === undefined ? undefined : titleId}
                className="grid grid-cols-1 gap-x-11 gap-y-3.5 border-t border-border py-7 first:border-t-0 first:pt-0 lg:grid-cols-[200px_1fr]"
            >
                <div className="flex min-w-0 flex-col gap-1.5">
                    {title !== undefined && (
                        <h2 id={titleId} className="text-title text-foreground">
                            {title}
                        </h2>
                    )}
                    {description !== undefined && (
                        <p className="text-small text-muted-foreground">
                            {description}
                        </p>
                    )}
                    {meta !== undefined && (
                        <div className="text-caption text-subtle-foreground">
                            {meta}
                        </div>
                    )}
                    {actions !== undefined && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            {actions}
                        </div>
                    )}
                </div>
                <div className="flex min-w-0 flex-col gap-3">
                    <div className="@container/settings-section flex flex-col divide-y divide-border/60">
                        {children}
                    </div>
                    {hasError && <FieldError>{error}</FieldError>}
                    {footer}
                </div>
            </section>
        );
    }

    return (
        <section
            data-slot="settings-section"
            aria-labelledby={title === undefined ? undefined : titleId}
            className="flex flex-col gap-2 border-t border-border py-7 first:border-t-0 first:pt-0"
        >
            {(title !== undefined || actions !== undefined) && (
                <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border pb-2.5">
                    {title !== undefined && (
                        <h2
                            id={titleId}
                            className="min-w-0 flex-auto truncate text-small font-medium text-muted-foreground"
                        >
                            {title}
                        </h2>
                    )}
                    {actions !== undefined && (
                        <div className="flex min-w-0 items-center gap-2">
                            {actions}
                        </div>
                    )}
                </div>
            )}
            <div className="flex flex-col gap-3">
                <div className="@container/settings-section flex flex-col divide-y divide-border/60">
                    {children}
                </div>
                {hasError && <FieldError>{error}</FieldError>}
                {footer}
            </div>
        </section>
    );
}

/**
 * One setting row with a wide control beside `label` and `description`.
 * `htmlFor` binds the label to the control with that id. `error` replaces the description and marks the field invalid.
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
    htmlFor?: string;
    description?: ReactNode;
    error?: ReactNode;
    align?: "center" | "top";
    children: ReactNode;
}) {
    const invalid = error !== undefined;

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
            className="flex items-center gap-4 py-2.5"
        >
            <div className="min-w-0 flex-1 text-body font-medium wrap-anywhere">
                {label}
            </div>
            <div className="flex shrink-0 items-center gap-2">{children}</div>
        </div>
    );
}
