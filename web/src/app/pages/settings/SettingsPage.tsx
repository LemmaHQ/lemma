import { Navigate, useParams } from "react-router";
import { useEffect } from "react";

import { SidebarRevealToggle } from "@/app/shell/SidebarToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
    if (section === null) {
        return <Navigate to="/settings/appearance" replace />;
    }

    return (
        <SidebarProvider className="h-dvh">
            <SettingsNav />
            <SidebarInset className="overflow-hidden">
                <div className="absolute top-3 left-3 z-10">
                    <SidebarRevealToggle />
                </div>
                {section === "providers" ? (
                    <ProvidersPanel />
                ) : (
                    <ScrollArea className="min-h-0 flex-1">
                        <AppearancePanel />
                    </ScrollArea>
                )}
            </SidebarInset>
        </SidebarProvider>
    );
}
