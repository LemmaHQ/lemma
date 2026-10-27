import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_STORAGE_KEY } from "@/features/preferences/theme";
import { PlatformProvider } from "@/platform/PlatformProvider";

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
                        <Toaster />
                    </TooltipProvider>
                </TitleBar>
            </PlatformProvider>
        </ThemeProvider>
    );
}
