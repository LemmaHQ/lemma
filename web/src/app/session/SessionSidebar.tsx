import {
    AnimateIcon,
    SettingsIcon,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@lemma/ui";
import { ViewTransition } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { SessionList } from "@/features/session";

import { AppBrand } from "../AppBrand";
import { paths } from "../route-paths";
import { SidebarToggleButton } from "../shell/SidebarToggleButton";
import { NewSessionButton } from "./NewSessionButton";

/** The sessions sidebar: brand, collapse toggle, new session, the session list with `activeId` highlighted, and the settings link. */
export function SessionSidebar({ activeId }: { activeId: string | null }) {
    const { t } = useTranslation();
    const { setOpenMobile } = useSidebar();
    const navigate = useNavigate();

    return (
        <>
            <ViewTransition
                name="shell-sidebar-header"
                share="ui-from-start"
                default="none"
            >
                <SidebarHeader>
                    <div className="flex h-8.5 items-center justify-between pl-1.5">
                        <AppBrand />
                        <SidebarToggleButton />
                    </div>
                    <NewSessionButton />
                </SidebarHeader>
            </ViewTransition>
            <SidebarContent>
                <ViewTransition
                    name="shell-sidebar"
                    share="ui-from-start"
                    default="none"
                >
                    <div className="flex flex-col">
                        <SessionList
                            activeId={activeId}
                            onOpen={(id) => {
                                void navigate(paths.session(id));
                            }}
                        />
                    </div>
                </ViewTransition>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <AnimateIcon animateOnHover asChild>
                            <SidebarMenuButton
                                render={<Link to={paths.settings} />}
                                onClick={() => setOpenMobile(false)}
                            >
                                <SettingsIcon />
                                <span>{t("sidebar.appSettings")}</span>
                            </SidebarMenuButton>
                        </AnimateIcon>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </>
    );
}
