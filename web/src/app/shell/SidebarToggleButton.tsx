import {
    SidebarTrigger,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    useSidebar,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

/** Collapses or expands the sidebar, labeled with the action it takes next. */
export function SidebarToggleButton() {
    const { t } = useTranslation();
    const { isMobile, open, openMobile } = useSidebar();
    const label = (isMobile ? openMobile : open)
        ? t("sidebar.collapse")
        : t("sidebar.expand");

    return (
        <Tooltip>
            <TooltipTrigger render={<SidebarTrigger aria-label={label} />} />
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
