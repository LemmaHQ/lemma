import { createBrowserRouter, replace } from "react-router";

import { refreshSessions } from "@/features/session";

import type { RouteHandle } from "./route-handle";
import { paths } from "./route-paths";
import { SETTINGS_PAGES } from "./settings/settings-pages";
import { AppLayout } from "./shell/AppLayout";
import { SplashScreen } from "./SplashScreen";

/** The app's routes; every `handle` is a `RouteHandle`. */
export const router = createBrowserRouter([
    {
        HydrateFallback: SplashScreen,
        children: [
            {
                Component: AppLayout,
                handle: { titleBar: "sidebar" } satisfies RouteHandle,
                loader: loadSessions,
                shouldRevalidate: () => false,
                children: [
                    {
                        lazy: async () => ({
                            Component: (await import("./session/SessionLayout"))
                                .SessionLayout,
                        }),
                        children: [
                            { path: paths.home, lazy: sessionPage },
                            {
                                path: "/sessions/:id",
                                lazy: sessionPage,
                            },
                        ],
                    },
                    {
                        path: paths.settings,
                        handle: { pinnedSidebar: true } satisfies RouteHandle,
                        lazy: async () => ({
                            Component: (
                                await import("./settings/SettingsLayout")
                            ).SettingsLayout,
                        }),
                        children: [
                            {
                                index: true,
                                loader: toDefaultSettings,
                                element: null,
                            },
                            ...SETTINGS_PAGES.map((page) => ({
                                path: page.segment,
                                caseSensitive: true,
                                lazy: async () => ({
                                    Component: await page.loadPage(),
                                }),
                            })),
                            {
                                path: ":segment",
                                loader: toDefaultSettings,
                                element: null,
                            },
                        ],
                    },
                ],
            },
            { path: "*", loader: () => replace(paths.home), element: null },
        ],
    },
]);

function loadSessions() {
    void refreshSessions();
    return null;
}

async function sessionPage() {
    return {
        Component: (await import("./session/SessionPage")).SessionPage,
    };
}

function toDefaultSettings() {
    return replace(paths.settingsPage("appearance"));
}
