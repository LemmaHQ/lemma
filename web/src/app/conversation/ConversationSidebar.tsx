import { SidebarContent, SidebarFooter, SidebarHeader } from "@lemma/ui";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { AccountMenu } from "@/features/auth";
import { ConversationList } from "@/features/conversations";

import { paths } from "../route-paths";
import { SidebarToggleButton } from "../shell/SidebarToggleButton";
import { NewConversationButton } from "./NewConversationButton";

/** The conversations sidebar: brand, collapse toggle, new conversation, the conversation list with `activeId` highlighted, and the account menu. */
export function ConversationSidebar({ activeId }: { activeId: string | null }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <>
            <SidebarHeader className="shell-transition-sidebar-header view-transition-from-start">
                <div className="flex h-8.5 items-center justify-between pl-1.5">
                    <span className="font-sidebar-brand text-lg text-sidebar-foreground">
                        {t("common.appName")}
                    </span>
                    <SidebarToggleButton />
                </div>
                <NewConversationButton />
            </SidebarHeader>
            <SidebarContent>
                <div className="flex flex-col shell-transition-sidebar view-transition-from-start">
                    <ConversationList
                        activeId={activeId}
                        onOpen={(id) => {
                            void navigate(paths.conversation(id));
                        }}
                    />
                </div>
            </SidebarContent>
            <SidebarFooter className="shell-transition-sidebar-footer view-transition-fade">
                <AccountMenu settingsPath={paths.settings} />
            </SidebarFooter>
        </>
    );
}
