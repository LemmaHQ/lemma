import { Sidebar, SidebarInset, useSidebar } from "@lemma/ui";
import { ViewTransition, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { SidebarToggleButton } from "./SidebarToggleButton";

/** A shell layout: the fixed-width `sidebar` beside the page content, with a floating reopen trigger when collapsed or on mobile. */
export function ShellFrame({
    sidebar,
    children,
}: {
    sidebar: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <>
            <Sidebar label={t("sidebar.title")}>{sidebar}</Sidebar>
            <SidebarInset className="overflow-hidden">
                <CollapsedSidebarTrigger />
                <ViewTransition
                    name="shell-main"
                    share="ui-rise"
                    default="none"
                >
                    <div className="flex min-h-0 flex-1 flex-col">
                        {children}
                    </div>
                </ViewTransition>
            </SidebarInset>
        </>
    );
}

function CollapsedSidebarTrigger() {
    const { isMobile, open } = useSidebar();
    if (!isMobile && open) {
        return null;
    }
    return (
        <div className="absolute top-3 left-3 z-20 rounded-md border border-border bg-background p-0.5 shadow-raised">
            <SidebarToggleButton />
        </div>
    );
}
