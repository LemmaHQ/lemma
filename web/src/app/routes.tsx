import { createBrowserRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";

import { AppShell } from "./shell/AppShell";
import { Loading, RequireAuth } from "./RequireAuth";

const router = createBrowserRouter([
    {
        HydrateFallback: Loading,
        children: [
            {
                path: "/login",
                lazy: async () => ({
                    Component: (await import("@/app/pages/LoginPage"))
                        .LoginPage,
                }),
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
