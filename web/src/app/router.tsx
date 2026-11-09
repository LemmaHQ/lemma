import { createBrowserRouter, replace } from "react-router";

import { ensureAuthReady, useAuth } from "@/features/auth";
import { refreshSessions } from "@/features/session";

import { AuthLayout } from "./auth/AuthLayout";
import type { RouteHandle } from "./route-handle";
import { paths } from "./route-paths";
import { SETTINGS_SECTIONS } from "./settings/settings-sections";
import { SignedInLayout } from "./shell/SignedInLayout";
import { SplashScreen } from "./SplashScreen";

/** The app's routes; every `handle` is a `RouteHandle`. */
export const router = createBrowserRouter([
    {
        HydrateFallback: SplashScreen,
        loader: authReady,
        children: [
            {
                Component: AuthLayout,
                children: [
                    {
                        path: paths.signIn,
                        lazy: async () => ({
                            Component: (await import("./auth/SignInPage"))
                                .SignInPage,
                        }),
                    },
                    {
                        path: paths.signUp,
                        lazy: async () => ({
                            Component: (await import("./auth/SignUpPage"))
                                .SignUpPage,
                        }),
                    },
                ],
            },
            {
                Component: SignedInLayout,
                loader: requireSignedIn,
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
                            ...SETTINGS_SECTIONS.map((section) => ({
                                path: section.segment,
                                caseSensitive: true,
                                lazy: async () => ({
                                    Component: await section.loadPage(),
                                }),
                            })),
                            {
                                path: ":section",
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

async function authReady() {
    await ensureAuthReady();
    return null;
}

async function requireSignedIn() {
    await ensureAuthReady();
    if (useAuth.getState().user === null) {
        return replace(paths.signIn);
    }
    void refreshSessions();
    return null;
}

async function sessionPage() {
    return {
        Component: (await import("./session/SessionPage")).SessionPage,
    };
}

function toDefaultSettings() {
    return replace(paths.settingsSection("appearance"));
}
