import { Navigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";

import { ShellSidebar } from "@/app/shell/ShellSidebar";
import { useShellTitle } from "@/app/shell/useShellTitle";
import { ScrollArea } from "@lemma/ui/components/scroll-area";
import { AppearancePanel } from "@/features/preferences/AppearancePanel";
import { ProvidersPanel } from "@/features/providers/ProvidersPanel";

import { parseSettingsSection } from "./sections";
import { SettingsNav } from "./SettingsNav";

export function SettingsPage() {
    const { t } = useTranslation();
    const section = parseSettingsSection(useParams().section);
    useShellTitle(
        section === "providers"
            ? t("settings.aiProviders")
            : t("settings.appearance"),
    );

    if (section === null) {
        return <Navigate to="/settings/appearance" replace />;
    }

    return (
        <>
            <ShellSidebar>
                <SettingsNav />
            </ShellSidebar>
            {section === "providers" ? (
                <ProvidersPanel />
            ) : (
                <ScrollArea className="min-h-0 flex-1">
                    <AppearancePanel />
                </ScrollArea>
            )}
        </>
    );
}
