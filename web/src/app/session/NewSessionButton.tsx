import {
    AnimateIcon,
    Button,
    MessageCirclePlusIcon,
    SidebarMenu,
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
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                        onClick={start}
                    >
                        <MessageCirclePlusIcon />
                        <span>{t("sidebar.startSession")}</span>
                    </Button>
                </AnimateIcon>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
