import { useId, type ReactNode } from "react";

import { FieldDescription, FieldError } from "#primitives/field";
import { Label } from "#primitives/label";
import { ScrollArea } from "#primitives/scroll-area";

/**
 * A scrolling settings page: one centered column under the page heading `title`.
 * `media` precedes the title and `actions` end its line; the children are the page's `SettingsSection`s.
 */
export function SettingsPage({
    title,
    media,
    actions,
    children,
}: {
    title: ReactNode;
    media?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <ScrollArea className="min-h-0 min-w-0 flex-1">
            <div
                data-slot="settings-page"
                className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-2 pb-12 md:px-6"
            >
                <header className="flex min-h-9 items-center gap-3 px-[17px]">
                    {media}
                    <h1 className="min-w-0 flex-1 truncate text-display">
                        {title}
                    </h1>
                    {actions !== undefined && (
                        <div className="flex shrink-0 items-center gap-1">
                            {actions}
                        </div>
                    )}
                </header>
                <div className="flex flex-col gap-8">{children}</div>
            </div>
        </ScrollArea>
    );
}

/**
 * A group of settings drawn as one bordered card whose children, `SettingsField`s and `SettingsRow`s, are divided by hairlines.
 * `title` names the group above the card; `actions` end the title's line, or take the line under it when the two do not fit on one.
 * Below the card, `error` reports a failure of the whole group, absent while `null`, and `footer` holds the bar of its pending changes.
 */
export function SettingsSection({
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

    return (
        <section
            data-slot="settings-section"
            aria-labelledby={title === undefined ? undefined : titleId}
            className="flex flex-col gap-2"
        >
            {title !== undefined && (
                <div className="flex flex-wrap items-center justify-end gap-2 pl-[17px]">
                    <h2
                        id={titleId}
                        className="min-w-0 flex-auto truncate text-small font-medium text-muted-foreground"
                    >
                        {title}
                    </h2>
                    {actions !== undefined && (
                        <div className="flex min-w-0 items-center gap-2">
                            {actions}
                        </div>
                    )}
                </div>
            )}
            <div className="flex flex-col gap-3">
                <div className="@container/settings-section flex flex-col divide-y rounded-lg border bg-card px-4">
                    {children}
                </div>
                {error !== undefined && error !== null && (
                    <FieldError className="px-[17px]">{error}</FieldError>
                )}
                {footer}
            </div>
        </section>
    );
}

/**
 * One setting with a wide control, such as an input or a toggle group: `label` and `description` beside a 20rem control column, stacked in a narrow section.
 * `htmlFor` binds the label to the control with that id. `error` replaces the description and marks the field invalid.
 */
export function SettingsField({
    label,
    htmlFor,
    description,
    error,
    children,
}: {
    label: ReactNode;
    htmlFor?: string;
    description?: ReactNode;
    error?: ReactNode;
    children: ReactNode;
}) {
    const invalid = error !== undefined;

    return (
        <div
            data-slot="settings-field"
            data-invalid={invalid ? "" : undefined}
            className="group/settings-field grid gap-x-6 gap-y-2 py-3 @md/settings-section:grid-cols-[minmax(0,1fr)_min(20rem,50%)] @md/settings-section:items-center"
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

/** One line of a section: `label` with its compact controls or actions at the end, such as an entry of a list with its remove button. */
export function SettingsRow({
    label,
    children,
}: {
    label: ReactNode;
    children: ReactNode;
}) {
    return (
        <div data-slot="settings-row" className="flex items-center gap-4 py-2">
            <div className="min-w-0 flex-1 text-body font-medium wrap-anywhere">
                {label}
            </div>
            <div className="flex shrink-0 items-center gap-2">{children}</div>
        </div>
    );
}
