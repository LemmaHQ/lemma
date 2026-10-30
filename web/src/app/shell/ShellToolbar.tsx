import type { ReactNode } from "react";

import { SidebarToggleButton } from "./SidebarToggleButton";

/** Raised toolbar at the top left of the page while the sidebar is hidden: the sidebar toggle, then `actions`. */
export function ShellToolbar({ actions }: { actions: ReactNode }) {
    return (
        <div className="flex items-center gap-0.5 rounded-lg border bg-background p-0.5 shadow-raised">
            <SidebarToggleButton />
            {actions}
        </div>
    );
}
