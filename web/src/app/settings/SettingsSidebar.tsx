import {
    SettingsIcon,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
} from "@lemma/ui";
import { ViewTransition } from "react";
import { useTranslation } from "react-i18next";

import { AppBrand } from "../AppBrand";
import { BackHomeButton } from "./BackHomeButton";
import { SettingsNav } from "./SettingsNav";

/** The settings sidebar: brand, back-to-sessions link, settings navigation, and active settings footer. */
export function SettingsSidebar() {
    const { t } = useTranslation();

    return (
        <>
            <ViewTransition
                name="shell-sidebar-header"
                share="ui-from-end"
                default="none"
            >
                <SidebarHeader>
                    <div className="flex h-8.5 items-center pl-1.5">
                        <AppBrand />
                    </div>
                    <BackHomeButton />
                </SidebarHeader>
            </ViewTransition>
            <SidebarContent>
                <ViewTransition
                    name="shell-sidebar"
                    share="ui-from-end"
                    default="none"
                >
                    <div className="flex flex-col">
                        <SettingsNav />
                    </div>
                </ViewTransition>
            </SidebarContent>
            <SidebarFooter>
                <div className="border-t border-border pt-2">
                    <div className="flex h-8 items-center gap-2 rounded-md bg-selected px-2 text-small font-medium text-sidebar-foreground">
                        <SettingsIcon
                            aria-hidden="true"
                            size={16}
                            className="shrink-0"
                        />
                        <span className="truncate">{t("common.settings")}</span>
                    </div>
                </div>
            </SidebarFooter>
        </>
    );
}
