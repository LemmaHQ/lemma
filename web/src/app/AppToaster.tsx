import { Toaster } from "@lemma/ui/components/sonner";
import { useTheme } from "next-themes";

import { usePlatformLayout } from "@/platform/hooks";

const TOAST_OFFSET = 24;
const TOAST_MOBILE_OFFSET = 16;

/** The toast host in the current theme, kept below the desktop titlebar. */
export function AppToaster() {
    const { resolvedTheme } = useTheme();
    const { titlebarHeight } = usePlatformLayout();

    return (
        <Toaster
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            offset={{ top: TOAST_OFFSET + titlebarHeight }}
            mobileOffset={{ top: TOAST_MOBILE_OFFSET + titlebarHeight }}
        />
    );
}
