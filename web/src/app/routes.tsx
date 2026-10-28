import { createBrowserRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";

import { AuthLayout } from "./auth/AuthLayout";
import { AppShell } from "./shell/AppShell";
import { RequireAuth } from "./RequireAuth";
import { SplashScreen } from "./SplashScreen";

const router = createBrowserRouter([
    {
        HydrateFallback: SplashScreen,
        children: [
            {
                Component: AuthLayout,
                children: [
                    {
                        path: "/signin",
                        lazy: async () => ({
                            Component: (await import("@/app/pages/SignInPage"))
                                .SignInPage,
                        }),
                    },
                    {
                        path: "/signup",
                        lazy: async () => ({
                            Component: (await import("@/app/pages/SignUpPage"))
                                .SignUpPage,
                        }),
                    },
                ],
            },
            {
                Component: RequireAuth,
                children: [
                    {
                        Component: AppShell,
                        children: [
                            {
                                path: "/",
                                lazy: conversationPage,
                            },
                            {
                                path: "/conversations/:id",
                                lazy: conversationPage,
                            },
                            {
                                path: "/settings",
                                element: (
                                    <Navigate
                                        to="/settings/appearance"
                                        replace
                                    />
                                ),
                            },
                            {
                                path: "/settings/:section",
                                lazy: async () => ({
                                    Component: (
                                        await import("@/app/pages/settings/SettingsPage")
                                    ).SettingsPage,
                                }),
                            },
                        ],
                    },
                ],
            },
            { path: "*", element: <Navigate to="/" replace /> },
        ],
    },
]);

async function conversationPage() {
    return {
        Component: (await import("@/app/pages/ConversationPage"))
            .ConversationPage,
    };
}

export function AppRoutes() {
    return <RouterProvider router={router} />;
}
