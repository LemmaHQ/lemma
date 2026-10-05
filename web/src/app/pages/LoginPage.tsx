import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { useEffect } from "react";

import { AuthCard } from "@/features/auth/AuthCard";
import { LanguageToggle } from "@/features/preferences/LanguageToggle";
import { ThemeToggle } from "@/features/preferences/ThemeToggle";
import { setTitleBarSurface } from "@/features/preferences/theme";
import { useAuth } from "@/features/auth/store";

export function LoginPage() {
    const { t } = useTranslation();
    const user = useAuth((s) => s.user);

    useEffect(() => {
        setTitleBarSurface("background");
    }, []);
    if (user) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="relative grid min-h-dvh place-items-center bg-background px-4">
            <div className="absolute top-4 right-4 flex items-center gap-1">
                <LanguageToggle />
                <ThemeToggle />
            </div>
            <div className="flex w-full max-w-95 flex-col items-center gap-4">
                <AuthCard />
                <p className="text-center text-xs text-muted-foreground">
                    {t("auth.selfHostedNote")}
                </p>
            </div>
        </div>
    );
}
