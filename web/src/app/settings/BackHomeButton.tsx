import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

import { getLastSessionPath } from "../route-paths";

/** The way back to sessions, shown in the settings sidebar header. */
export function BackHomeButton() {
    const { t } = useTranslation();
    const { setOpenMobile } = useSidebar();
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    render={<NavLink to={getLastSessionPath()} end />}
                    onClick={() => setOpenMobile(false)}
                >
                    <span>{t("sidebar.backToSessions")}</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
