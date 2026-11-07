import { SidebarContent, SidebarHeader } from "@lemma/ui";
import { ViewTransition } from "react";

import { BackHomeButton } from "./BackHomeButton";
import { SettingsNav } from "./SettingsNav";

/** The settings sidebar: the way back home above the settings sections. */
export function SettingsSidebar() {
    return (
        <>
            <ViewTransition
                name="shell-sidebar-header"
                share="ui-from-end"
                default="none"
            >
                <SidebarHeader>
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
        </>
    );
}
