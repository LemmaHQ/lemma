import {
    AnimateIcon,
    MessageCirclePlusIcon,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

import { useStartSession } from "./useStartSession";

/** The labeled sidebar card that opens the home view for a new session. */
export function NewSessionButton() {
    const { t } = useTranslation();
    const start = useStartSession();

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
                        <span>{t("sidebar.startSession")}</span>
                    </SidebarMenuButton>
                </AnimateIcon>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
