import { useTranslation } from "react-i18next";
import { Outlet, useParams } from "react-router";

import { useSessionTitle } from "@/features/session";

import { ShellFrame } from "../shell/ShellFrame";
import { SessionSidebar } from "./SessionSidebar";
import { NewSessionIconButton } from "./NewSessionIconButton";

/** The layout route of home and the sessions, titled with the open session. */
export function SessionLayout() {
    const { t } = useTranslation();
    const activeId = useParams().id ?? null;
    const storedTitle = useSessionTitle(activeId);

    return (
        <ShellFrame
            sidebar={<SessionSidebar activeId={activeId} />}
            toolbarActions={<NewSessionIconButton />}
            title={
                activeId === null
                    ? undefined
                    : storedTitle !== undefined && storedTitle !== ""
                      ? storedTitle
                      : t("sidebar.newSession")
            }
        >
            <Outlet />
        </ShellFrame>
    );
}
