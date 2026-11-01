import { useTranslation } from "react-i18next";
import { matchPath, Outlet, useLocation } from "react-router";

import { paths } from "../route-paths";
import { ShellFrame } from "../shell/ShellFrame";
import { SETTINGS_SECTIONS } from "./settings-sections";
import { SettingsSidebar } from "./SettingsSidebar";

/** The layout route of the settings sections, titled with the open section. */
export function SettingsLayout() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const [title] = SETTINGS_SECTIONS.filter(
        (s) => matchPath(paths.settingsSection(s.segment), pathname) !== null,
    ).map((s) => t(s.titleKey));

    return (
        <ShellFrame sidebar={<SettingsSidebar />} title={title}>
            <Outlet />
        </ShellFrame>
    );
}
