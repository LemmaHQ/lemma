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
    const section = SETTINGS_SECTIONS.find(
        (s) => matchPath(paths.settingsSection(s.segment), pathname) !== null,
    );

    return (
        <ShellFrame
            sidebar={<SettingsSidebar />}
            title={section === undefined ? undefined : t(section.titleKey)}
        >
            <Outlet />
        </ShellFrame>
    );
}
