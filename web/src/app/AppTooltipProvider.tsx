import { TooltipProvider } from "@lemma/ui";
import type { ReactNode } from "react";

import { getPlatform } from "@/platform/platform";

const TOOLTIP_EDGE_PADDING = 5;
const TOOLTIP_TITLEBAR_GAP = 4;

/** The tooltip provider, keeping every tooltip clear of the desktop titlebar. */
export function AppTooltipProvider({ children }: { children: ReactNode }) {
    const { hasCustomTitlebar, titlebarHeight } = getPlatform().layout;

    return (
        <TooltipProvider
            collisionPadding={
                hasCustomTitlebar
                    ? { top: titlebarHeight + TOOLTIP_TITLEBAR_GAP }
                    : TOOLTIP_EDGE_PADDING
            }
        >
            {children}
        </TooltipProvider>
    );
}
