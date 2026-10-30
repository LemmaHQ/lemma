import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { ShellSidebar } from "@/app/shell/ShellSidebar";
import { useShellTitle } from "@/app/shell/useShellTitle";
import { ConversationView } from "@/features/agent";
import { ConversationList, useConversations } from "@/features/conversations";

export function ConversationPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const activeId = useParams().id ?? null;
    const conversations = useConversations();

    const activeTitle = conversations.list.find(
        (c) => c.id === activeId,
    )?.title;
    useShellTitle(
        activeId === null
            ? undefined
            : activeTitle !== undefined && activeTitle !== ""
              ? activeTitle
              : t("sidebar.newConversation"),
    );

    return (
        <>
            <ShellSidebar>
                <ConversationList
                    activeId={activeId}
                    onOpen={(id) => {
                        void navigate(`/conversations/${id}`);
                    }}
                />
            </ShellSidebar>
            <ConversationView
                conversationId={activeId}
                onConversationCreated={(id) => {
                    void navigate(`/conversations/${id}`);
                }}
                onModelMissing={() => {
                    void navigate("/settings/providers", {
                        viewTransition: true,
                    });
                }}
            />
        </>
    );
}
