import { useTranslation } from "react-i18next";
import { Outlet, useParams } from "react-router";

import { useConversationTitle } from "@/features/conversations";

import { ShellFrame } from "../shell/ShellFrame";
import { ConversationSidebar } from "./ConversationSidebar";
import { NewConversationIconButton } from "./NewConversationIconButton";

/** The layout route of home and the conversations, titled with the open conversation. */
export function ConversationLayout() {
    const { t } = useTranslation();
    const activeId = useParams().id ?? null;
    const storedTitle = useConversationTitle(activeId);

    return (
        <ShellFrame
            sidebar={<ConversationSidebar activeId={activeId} />}
            toolbarActions={<NewConversationIconButton />}
            title={
                activeId === null
                    ? undefined
                    : storedTitle !== undefined && storedTitle !== ""
                      ? storedTitle
                      : t("sidebar.newConversation")
            }
        >
            <Outlet />
        </ShellFrame>
    );
}
