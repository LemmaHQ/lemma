import { TooltipProvider } from "@lemma/ui";
import { ThemeProvider } from "next-themes";
import { RouterProvider } from "react-router/dom";

import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/features/preferences";

import { AppToaster } from "./AppToaster";
import { router } from "./router";

export function App() {
    return (
        <ThemeProvider
            attribute="class"
            storageKey={THEME_STORAGE_KEY}
            defaultTheme={DEFAULT_THEME}
            disableTransitionOnChange
            scriptProps={{ type: "application/json" }}
        >
            <TooltipProvider>
                <RouterProvider router={router} />
                <AppToaster />
            </TooltipProvider>
        </ThemeProvider>
    );
}
