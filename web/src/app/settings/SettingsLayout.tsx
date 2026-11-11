import { Outlet } from "react-router";

import { ShellFrame } from "../shell/ShellFrame";
import { SettingsSidebar } from "./SettingsSidebar";

/** The layout route of the settings pages; each page shows its own heading. */
export function SettingsLayout() {
    return (
        <ShellFrame sidebar={<SettingsSidebar />} title={undefined}>
            <Outlet />
        </ShellFrame>
    );
}
