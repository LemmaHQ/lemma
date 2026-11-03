import {
    AnimateIcon,
    Button,
    MessageCirclePlusIcon,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

import { useStartSession } from "./useStartSession";

/** The shell toolbar icon, with a tooltip, that opens the home view for a new session. */
export function NewSessionIconButton() {
    const { t } = useTranslation();
    const start = useStartSession();
    const label = t("sidebar.startSession");

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
