import { Toaster } from "@lemma/ui";
import { useTheme } from "next-themes";

const TOAST_OFFSET = 24;
const TOAST_MOBILE_OFFSET = 16;

/** The toast host in the current theme. */
export function AppToaster() {
    const { resolvedTheme } = useTheme();

    return (
        <Toaster
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            offset={{ top: TOAST_OFFSET }}
            mobileOffset={{ top: TOAST_MOBILE_OFFSET }}
        />
    );
}
