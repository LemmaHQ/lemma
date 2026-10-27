import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@lemma/ui/components/sidebar";
import { useSidebar } from "@lemma/ui/hooks/use-sidebar";
import { IconArrowLeft } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

/** The way back to conversations, shown as the sidebar header of the settings pages. */
export function BackHomeButton() {
    const { t } = useTranslation();
    const { setOpenMobile } = useSidebar();
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    className="font-medium text-sidebar-foreground"
                    render={<NavLink to="/" end viewTransition />}
                    onClick={() => setOpenMobile(false)}
                >
                    <IconArrowLeft />
                    <span>{t("settings.backToHome")}</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
