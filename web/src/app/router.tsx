import { createBrowserRouter, replace } from "react-router";

import { ensureAuthReady, useAuth } from "@/features/auth";
import { refreshConversations } from "@/features/conversations";

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
                handle: { titleBar: "background" } satisfies RouteHandle,
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
                handle: { titleBar: "sidebar" } satisfies RouteHandle,
                loader: startSignedInSession,
                shouldRevalidate: () => false,
                children: [
                    {
                        lazy: async () => ({
                            Component: (
                                await import("./conversation/ConversationLayout")
                            ).ConversationLayout,
                        }),
                        children: [
                            { path: paths.home, lazy: conversationPage },
                            {
                                path: "/conversations/:id",
                                lazy: conversationPage,
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
                            { index: true, loader: toDefaultSettings },
                            ...SETTINGS_SECTIONS.map((section) => ({
                                path: section.segment,
                                caseSensitive: true,
                                lazy: async () => ({
                                    Component: await section.loadPage(),
                                }),
                            })),
                            { path: ":section", loader: toDefaultSettings },
                        ],
                    },
                ],
            },
            { path: "*", loader: () => replace(paths.home) },
        ],
    },
]);

async function authReady() {
    await ensureAuthReady();
    return null;
}

async function startSignedInSession() {
    await ensureAuthReady();
    if (useAuth.getState().user === null) {
        return replace(paths.signIn);
    }
    void refreshConversations();
    return null;
}

async function conversationPage() {
    return {
        Component: (await import("./conversation/ConversationPage"))
            .ConversationPage,
    };
}

function toDefaultSettings() {
    return replace(paths.settingsSection("appearance"));
}
