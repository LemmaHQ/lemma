import { cn, useSidebar } from "@lemma/ui";
import { type ReactNode, ViewTransition } from "react";

import { ShellToolbar } from "./ShellToolbar";

/** The page header: `title`, and the shell toolbar revealed while the sidebar is hidden. */
export function ShellHeader({
    toolbarActions,
    title,
}: {
    toolbarActions: ReactNode;
    title: string | undefined;
}) {
    const { isMobile, open } = useSidebar();
    const revealed = isMobile || !open;

    return (
        <header
            data-revealed={revealed ? "" : undefined}
            data-titled={title === undefined ? undefined : ""}
            className={cn(
                "group/shell-header relative flex h-12 shrink-0 items-center gap-2 px-3 transition-all duration-reveal ease-enter data-titled:border-b motion-reduce:transition-none",
                toolbarActions === undefined
                    ? "data-revealed:pl-12"
                    : "data-revealed:pl-20",
            )}
        >
            <div className="invisible absolute left-2 opacity-0 transition-sidebar-reveal-hide group-data-revealed/shell-header:visible group-data-revealed/shell-header:opacity-100 group-data-revealed/shell-header:transition-sidebar-reveal-show motion-reduce:transition-none">
                <ShellToolbar actions={toolbarActions} />
            </div>
            <ViewTransition name="shell-title" share="ui-fade" default="none">
                <div className="min-w-0 flex-1 truncate text-title text-foreground">
                    {title}
                </div>
            </ViewTransition>
        </header>
    );
}
