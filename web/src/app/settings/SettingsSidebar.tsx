import { SidebarContent, SidebarHeader } from "@lemma/ui";

import { BackHomeButton } from "./BackHomeButton";
import { SettingsNav } from "./SettingsNav";

/** The settings sidebar: the way back home above the settings sections. */
export function SettingsSidebar() {
    return (
        <>
            <SidebarHeader className="shell-transition-sidebar-header view-transition-from-end">
                <BackHomeButton />
            </SidebarHeader>
            <SidebarContent>
                <div className="flex flex-col shell-transition-sidebar view-transition-from-end">
                    <SettingsNav />
                </div>
            </SidebarContent>
        </>
    );
}
