import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlatformProvider } from "@/platform";

import { AppRoutes } from "./routes";
import { AppShell } from "./shell/AppShell";
import { useAccountRuntime } from "./useAccountRuntime";
export function App() {
    useAccountRuntime();

    return (
        <PlatformProvider>
            <AppShell>
                <TooltipProvider>
                    <AppRoutes />
                    <Toaster />
                </TooltipProvider>
            </AppShell>
        </PlatformProvider>
    );
}
