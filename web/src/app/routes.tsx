import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { Loading, RequireAuth } from "./RequireAuth";

const ConversationPage = lazy(() =>
    import("@/app/pages/ConversationPage").then((m) => ({
        default: m.ConversationPage,
    })),
);
const LoginPage = lazy(() =>
    import("@/app/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const SettingsPage = lazy(() =>
    import("@/app/pages/settings/SettingsPage").then((m) => ({
        default: m.SettingsPage,
    })),
);

export function AppRoutes() {
    return (
        <BrowserRouter>
            <Suspense fallback={<Loading />}>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route element={<RequireAuth />}>
                        <Route path="/" element={<ConversationPage />} />
                        <Route
                            path="/conversations/:id"
                            element={<ConversationPage />}
                        />
                        <Route
                            path="/settings"
                            element={
                                <Navigate to="/settings/appearance" replace />
                            }
                        />
                        <Route
                            path="/settings/:section"
                            element={<SettingsPage />}
                        />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}
