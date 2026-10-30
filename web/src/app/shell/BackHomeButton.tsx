import {
    AnimateIcon,
    ArrowLeftIcon,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@lemma/ui";
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
                        variant="strong"
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
