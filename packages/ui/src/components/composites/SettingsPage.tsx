import type { ReactNode } from "react";

import { ScrollArea } from "#primitives/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "#primitives/tooltip";

/**
 * A scrolling settings page: one centered 760px column, or an 840px two-pane
 * workbench when `index` supplies a 220px sticky directory before the detail canvas.
 */
export function SettingsPage({
    index,
    title,
    badge,
    actions,
    children,
}: {
    index?: ReactNode;
    title?: ReactNode;
    badge?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}) {
    const hasHeader =
        title !== undefined || badge !== undefined || actions !== undefined;

    const detail = (
        <>
            {hasHeader && (
                <header className="mb-3.5 flex min-h-9 items-center gap-3.5 border-b border-border pb-4">
                    {title !== undefined && (
                        <h1 className="min-w-0 truncate text-display">
                            {typeof title === "string" ? (
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <span className="block truncate" />
                                        }
                                    >
                                        {title}
                                    </TooltipTrigger>
                                    <TooltipContent>{title}</TooltipContent>
                                </Tooltip>
                            ) : (
                                title
                            )}
                        </h1>
                    )}
                    {badge !== undefined && (
                        <span className="shrink-0 text-small text-subtle-foreground">
                            {badge}
                        </span>
                    )}
                    {actions !== undefined && (
                        <div className="ml-auto flex shrink-0 items-center gap-2.5">
                            {actions}
                        </div>
                    )}
                </header>
            )}
            <div className="flex flex-col">{children}</div>
        </>
    );

    return (
        <ScrollArea className="min-h-0 min-w-0 flex-1">
            {index === undefined ? (
                <div
                    data-slot="settings-page"
                    className="mx-auto flex w-full max-w-190 flex-col px-4 pt-12 pb-16 md:px-8"
                >
                    {detail}
                </div>
            ) : (
                <div
                    data-slot="settings-page"
                    className="mx-auto flex w-full max-w-210 flex-col gap-6 px-4 pt-12 pb-16 md:px-8 lg:flex-row lg:items-start lg:gap-11"
                >
                    <div className="w-full shrink-0 lg:sticky lg:top-0 lg:w-55">
                        {index}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col border-t border-border pt-6 lg:min-h-115 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
                        {detail}
                    </div>
                </div>
            )}
        </ScrollArea>
    );
}
