import { TooltipProvider } from "@/components/ui/tooltip";

import { AppRoutes } from "./routes";
import { useAccountRuntime } from "./useAccountRuntime";

export function App() {
    useAccountRuntime();

    return (
        <TooltipProvider>
            <AppRoutes />
        </TooltipProvider>
    );
}
