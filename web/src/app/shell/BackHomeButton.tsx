import { AnimateIcon } from "@animate-ui/react/icons";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@lemma/ui/components/sidebar";
import { useSidebar } from "@lemma/ui/hooks/use-sidebar";
import { ArrowLeftIcon } from "@lemma/ui/icons/arrow-left";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

/** The way back to conversations, shown as the sidebar header of the settings pages. */
export function BackHomeButton() {
    const { t } = useTranslation();
    const { setOpenMobile } = useSidebar();
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <AnimateIcon animateOnHover asChild>
                    <SidebarMenuButton
                        className="font-medium text-sidebar-foreground"
                        render={<NavLink to="/" end viewTransition />}
                        onClick={() => setOpenMobile(false)}
                    >
                        <ArrowLeftIcon />
                        <span>{t("settings.backToHome")}</span>
                    </SidebarMenuButton>
                </AnimateIcon>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
