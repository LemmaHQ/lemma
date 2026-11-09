import {
    LemmaLogo,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
} from "@lemma/ui";
import { ViewTransition } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { AccountMenu } from "@/features/auth";
import { SessionList } from "@/features/session";

import { paths } from "../route-paths";
import { SidebarToggleButton } from "../shell/SidebarToggleButton";
import { NewSessionButton } from "./NewSessionButton";

/** The sessions sidebar: brand, collapse toggle, new session, the session list with `activeId` highlighted, and the account menu. */
export function SessionSidebar({ activeId }: { activeId: string | null }) {
    const { t } = useTranslation();
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
                        <div className="flex items-center gap-2">
                            <LemmaLogo className="size-5" />
                            <span className="text-body font-semibold text-sidebar-foreground">
                                {t("common.appName")}
                            </span>
                        </div>
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
                <AccountMenu settingsPath={paths.settings} />
            </SidebarFooter>
        </>
    );
}
