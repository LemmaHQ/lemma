import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@lemma/ui";
import { useTranslation } from "react-i18next";

import { useStartSession } from "./useStartSession";

/** The sidebar button that opens the home view for a new session, showing a hover-revealed Ctrl+N hint. */
export function NewSessionButton() {
    const { t } = useTranslation();
    const start = useStartSession();

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    aria-keyshortcuts="Control+N Meta+N"
                    className="justify-between"
                    onClick={start}
                >
                    <span className="truncate">
                        {t("sidebar.startSession")}
                    </span>
                    <kbd
                        aria-hidden="true"
                        className="text-caption text-subtle-foreground opacity-0 transition-opacity duration-fast group-hover/menu-button:opacity-100 group-focus-visible/menu-button:opacity-100"
                    >
                        Ctrl N
                    </kbd>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
