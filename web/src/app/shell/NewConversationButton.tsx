import { AnimateIcon } from "@animate-ui/react/icons";
import { Button } from "@lemma/ui/components/button";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@lemma/ui/components/sidebar";
import { useSidebar } from "@lemma/ui/hooks/use-sidebar";
import { MessageCirclePlusIcon } from "@lemma/ui/icons/message-circle-plus";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui/components/tooltip";

/** Opens the home view for a new conversation: a labeled card in the sidebar, or an icon in the shell toolbar when `compact`. */
export function NewConversationButton({
    compact = false,
}: {
    compact?: boolean;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { setOpenMobile } = useSidebar();
    const label = t("sidebar.startConversation");
    const start = () => {
        setOpenMobile(false);
        void navigate("/");
    };

    if (compact) {
        return (
            <Tooltip>
                <AnimateIcon animateOnHover asChild>
                    <TooltipTrigger
                        render={
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={label}
                                onClick={start}
                            />
                        }
                    >
                        <MessageCirclePlusIcon />
                    </TooltipTrigger>
                </AnimateIcon>
                <TooltipContent>{label}</TooltipContent>
            </Tooltip>
        );
    }

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
                        <span>{label}</span>
                    </SidebarMenuButton>
                </AnimateIcon>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
