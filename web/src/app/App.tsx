import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_STORAGE_KEY } from "@/features/preferences/theme";
import { PlatformProvider } from "@/platform";

import { AppRoutes } from "./routes";
import { AppShell } from "./shell/AppShell";
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
                <AppShell>
                    <TooltipProvider>
                        <AppRoutes />
                        <Toaster />
                    </TooltipProvider>
                </AppShell>
            </PlatformProvider>
        </ThemeProvider>
    );
}
