import {
    AnimateIcon,
    MessageCirclePlusIcon,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

import { useStartConversation } from "./useStartConversation";

/** The labeled sidebar card that opens the home view for a new conversation. */
export function NewConversationButton() {
    const { t } = useTranslation();
    const start = useStartConversation();

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <AnimateIcon animateOnHover asChild>
                    <SidebarMenuButton
                        variant="outline"
                        size="lg"
                        className="justify-center"
                        onClick={start}
                    >
                        <MessageCirclePlusIcon />
                        <span>{t("sidebar.startConversation")}</span>
                    </SidebarMenuButton>
                </AnimateIcon>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
