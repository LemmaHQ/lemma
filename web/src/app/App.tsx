import { ThemeProvider } from "next-themes";
import { RouterProvider } from "react-router/dom";

import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/features/preferences";

import { AppToaster } from "./AppToaster";
import { AppTooltipProvider } from "./AppTooltipProvider";
import { router } from "./router";
import { TitleBar } from "./TitleBar";

export function App() {
    return (
        <ThemeProvider
            attribute="class"
            storageKey={THEME_STORAGE_KEY}
            defaultTheme={DEFAULT_THEME}
            disableTransitionOnChange
            scriptProps={{ type: "application/json" }}
        >
            <TitleBar />
            <AppTooltipProvider>
                <RouterProvider router={router} />
                <AppToaster />
            </AppTooltipProvider>
        </ThemeProvider>
    );
}
