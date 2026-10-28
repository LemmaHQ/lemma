import { Navigate, Outlet } from "react-router";

import { useAuth } from "@/features/auth/store";

import { SplashScreen } from "./SplashScreen";

export function RequireAuth() {
    const user = useAuth((s) => s.user);
    const ready = useAuth((s) => s.ready);

    if (!ready) {
        return <SplashScreen />;
    }
    if (user === null) {
        return <Navigate to="/signin" replace />;
    }
    return <Outlet />;
}
