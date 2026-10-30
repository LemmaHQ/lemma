import { ThemeProvider } from "next-themes";
import { RouterProvider } from "react-router/dom";

import { THEME_STORAGE_KEY } from "@/features/preferences";

import { AppToaster } from "./AppToaster";
import { AppTooltipProvider } from "./AppTooltipProvider";
import { router } from "./router";
import { TitleBar } from "./TitleBar";

export function App() {
    return (
        <ThemeProvider
            attribute="class"
            storageKey={THEME_STORAGE_KEY}
            disableTransitionOnChange
        >
            <TitleBar />
            <AppTooltipProvider>
                <RouterProvider router={router} />
                <AppToaster />
            </AppTooltipProvider>
        </ThemeProvider>
    );
}
