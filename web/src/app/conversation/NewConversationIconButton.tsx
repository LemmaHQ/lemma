import {
    AnimateIcon,
    Button,
    MessageCirclePlusIcon,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

import { useStartConversation } from "./useStartConversation";

/** The shell toolbar icon, with a tooltip, that opens the home view for a new conversation. */
export function NewConversationIconButton() {
    const { t } = useTranslation();
    const start = useStartConversation();
    const label = t("sidebar.startConversation");

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
