import { Sidebar, SidebarInset, SidebarRail } from "@lemma/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ShellHeader } from "./ShellHeader";

/**
 * A signed-in layout: the resizable `sidebar` beside the page, with a header across the page showing `title`.
 * `sidebar` holds the sidebar's header, content, and footer; `toolbarActions` follow the sidebar toggle while the sidebar is hidden.
 */
export function ShellFrame({
    sidebar,
    toolbarActions,
    title,
    children,
}: {
    sidebar: ReactNode;
    toolbarActions?: ReactNode;
    title: string | undefined;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <>
            <Sidebar label={t("sidebar.title")}>
                {sidebar}
                <SidebarRail aria-label={t("sidebar.resize")} />
            </Sidebar>
            <SidebarInset className="overflow-hidden">
                <ShellHeader toolbarActions={toolbarActions} title={title} />
                <div className="flex min-h-0 flex-1 flex-col shell-transition-main view-transition-rise">
                    {children}
                </div>
            </SidebarInset>
        </>
    );
}
