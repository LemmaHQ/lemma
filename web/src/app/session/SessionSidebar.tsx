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

import { clearSessionDraft } from "@/features/agent";
import { SessionList, type SessionDirectoryState } from "@/features/session";

import { paths, rememberSessionPath, sessionPath } from "../route-paths";
import { AppBrand } from "../shell/AppBrand";
import { SidebarToggleButton } from "../shell/SidebarToggleButton";
import { NewSessionButton } from "./NewSessionButton";

/** The sessions sidebar: brand, collapse toggle, new session, directory-grouped sessions, and settings link. */
export function SessionSidebar({
    activeId,
    directoryState,
}: {
    activeId: string | null;
    directoryState: SessionDirectoryState;
}) {
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
                            activeSessionId={activeId ?? undefined}
                            activeNewDirectory={directoryState.directory}
                            isNewSessionView={activeId === null}
                            onSelectSession={(id) => {
                                setOpenMobile(false);
                                void navigate(paths.session(id));
                            }}
                            onNewInDirectory={(dir) => {
                                directoryState.selectDirectory(dir);
                                setOpenMobile(false);
                                void navigate(paths.home);
                            }}
                            onSessionDeleted={clearSessionDraft}
                        />
                    </div>
                </ViewTransition>
            </SidebarContent>
            <SidebarFooter>
                <div className="border-t border-border pt-2">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <AnimateIcon animateOnHover asChild>
                                <SidebarMenuButton
                                    aria-label={t("sidebar.appSettings")}
                                    render={<Link to={paths.settings} />}
                                    onClick={() => {
                                        rememberSessionPath(
                                            sessionPath(activeId),
                                        );
                                        setOpenMobile(false);
                                    }}
                                >
                                    <SettingsIcon />
                                    <span>{t("common.settings")}</span>
                                </SidebarMenuButton>
                            </AnimateIcon>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </div>
            </SidebarFooter>
        </>
    );
}
