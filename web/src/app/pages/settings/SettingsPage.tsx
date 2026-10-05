import { Navigate, useParams } from "react-router";
import { useEffect } from "react";

import { AppearancePanel } from "@/features/preferences/AppearancePanel";
import { ProvidersPanel } from "@/features/providers/ProvidersPanel";
import { setTitleBarSurface } from "@/features/preferences/theme";

import { parseSettingsSection } from "./sections";
import { SettingsNav } from "./SettingsNav";

export function SettingsPage() {
    const section = parseSettingsSection(useParams().section);

    useEffect(() => {
        setTitleBarSurface("sidebar");
    }, []);
    if (!section) {
        return <Navigate to="/settings/appearance" replace />;
    }

    return (
        <div className="flex h-dvh gap-2 bg-sidebar p-2 text-foreground">
            <SettingsNav />
            {section === "providers" ? (
                <ProvidersPanel />
            ) : (
                <main className="min-w-0 flex-1 overflow-y-auto rounded-lg border border-border bg-background">
                    <AppearancePanel />
                </main>
            )}
        </div>
    );
}
