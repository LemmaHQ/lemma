import { lazy, Suspense } from "react";
import {
    BrowserRouter,
    HashRouter,
    Navigate,
    Route,
    Routes,
} from "react-router";

import { Loading, RequireAuth } from "./RequireAuth";

const ChatPage = lazy(() =>
    import("@/app/pages/ChatPage").then((m) => ({ default: m.ChatPage })),
);
const LoginPage = lazy(() =>
    import("@/app/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const SettingsPage = lazy(() =>
    import("@/app/pages/settings/SettingsPage").then((m) => ({
        default: m.SettingsPage,
    })),
);

const Router =
    window.location.protocol === "file:" ? HashRouter : BrowserRouter;

export function AppRoutes() {
    return (
        <Router>
            <Suspense fallback={<Loading />}>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route element={<RequireAuth />}>
                        <Route path="/" element={<ChatPage />} />
                        <Route
                            path="/conversations/:id"
                            element={<ChatPage />}
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
        </Router>
    );
}
