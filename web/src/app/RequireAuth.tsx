import { useTranslation } from "react-i18next";
import { Navigate, Outlet } from "react-router";

import { useAuth } from "@/features/auth/store";

export function Loading() {
    const { t } = useTranslation();
    return (
        <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
            {t("common.loading")}
        </div>
    );
}

export function RequireAuth() {
    const user = useAuth((s) => s.user);
    const ready = useAuth((s) => s.ready);

    if (!ready) return <Loading />;
    if (!user) return <Navigate to="/login" replace />;
    return <Outlet />;
}
