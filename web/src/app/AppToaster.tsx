import { Toaster } from "@lemma/ui";
import { useTheme } from "next-themes";

import { getPlatform } from "@/platform/platform";

const TOAST_OFFSET = 24;
const TOAST_MOBILE_OFFSET = 16;

/** The toast host in the current theme, kept below the desktop titlebar. */
export function AppToaster() {
    const { resolvedTheme } = useTheme();
    const { titlebarHeight } = getPlatform().layout;

    return (
        <Toaster
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            offset={{ top: TOAST_OFFSET + titlebarHeight }}
            mobileOffset={{ top: TOAST_MOBILE_OFFSET + titlebarHeight }}
        />
    );
}
