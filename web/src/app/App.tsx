import { ThemeProvider } from "next-themes";

import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_STORAGE_KEY } from "@/features/preferences/theme";
import { PlatformProvider } from "@/platform/PlatformProvider";

import { AppToaster } from "./AppToaster";
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
                    <TooltipProvider>
                        <AppRoutes />
                        <AppToaster />
                    </TooltipProvider>
                </TitleBar>
            </PlatformProvider>
        </ThemeProvider>
    );
}
