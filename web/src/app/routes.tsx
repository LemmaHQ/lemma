import { lazy, Suspense } from "react";
import {
    BrowserRouter,
    HashRouter,
    Navigate,
    Route,
    Routes,
} from "react-router";

import { Loading, RequireAuth } from "./RequireAuth";

const ChatPage = lazy(() => import("@/app/pages/ChatPage"));
const LoginPage = lazy(() => import("@/app/pages/LoginPage"));
const SettingsPage = lazy(() => import("@/app/pages/settings/SettingsPage"));

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
