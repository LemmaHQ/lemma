import { ThemeProvider } from "next-themes";

import { THEME_STORAGE_KEY } from "@/features/preferences/theme";
import { PlatformProvider } from "@/platform/PlatformProvider";

import { AppToaster } from "./AppToaster";
import { AppTooltipProvider } from "./AppTooltipProvider";
import { AppRoutes } from "./routes";
import { TitleBar } from "./shell/TitleBar";
import { useAccountRuntime } from "./useAccountRuntime";
export function App() {
    useAccountRuntime();

    return (
        <ThemeProvider
            attribute="class"
            storageKey={THEME_STORAGE_KEY}
            disableTransitionOnChange
        >
            <PlatformProvider>
                <TitleBar>
                    <AppTooltipProvider>
                        <AppRoutes />
                        <AppToaster />
                    </AppTooltipProvider>
                </TitleBar>
            </PlatformProvider>
        </ThemeProvider>
    );
}
