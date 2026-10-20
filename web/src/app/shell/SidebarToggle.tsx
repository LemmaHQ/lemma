import { useTranslation } from "react-i18next";

import { SidebarTrigger } from "@/components/ui/sidebar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/lib/hooks/use-sidebar";

/** Sidebar trigger labeled with the action it performs. */
export function SidebarToggle() {
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

/** Sidebar trigger rendered only while the sidebar is out of view. */
export function SidebarRevealToggle() {
    const { isMobile, open } = useSidebar();
    if (open && !isMobile) {
        return null;
    }
    return <SidebarToggle />;
}
