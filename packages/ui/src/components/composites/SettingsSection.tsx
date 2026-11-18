import { useId, type ReactNode } from "react";

import { FieldError } from "#primitives/field";

/**
 * A 2-column hairline-divided settings section with a 200px left aside
 * (`title`, `description`, `meta`, `actions`) beside stacked rows.
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
    const hasError = error !== undefined && error !== null;

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

/**
 * A compact single-column hairline-divided settings section with a subhead bar
 * (`title` and `actions`) above stacked rows.
 */
export function SettingsSectionCompact({
    title,
    actions,
    error,
    footer,
    children,
}: {
    title?: ReactNode;
    actions?: ReactNode;
    error?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
}) {
    const titleId = useId();
    const hasError = error !== undefined && error !== null;

    return (
        <section
            data-slot="settings-section-compact"
            aria-labelledby={title === undefined ? undefined : titleId}
            className="flex flex-col gap-2 pt-5 pb-2 first:pt-0"
        >
            {(title !== undefined || actions !== undefined) && (
                <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border pb-1.5">
                    {title !== undefined && (
                        <h2
                            id={titleId}
                            className="min-w-0 flex-auto truncate text-caption text-subtle-foreground"
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
