import { SettingsPage, Switch } from "@lemma/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ProviderHeaderProps {
    index?: ReactNode;
    name: string;
    badge: string;
    enabled: boolean;
    toggleDisabled: boolean;
    onToggleEnabled: (enabled: boolean) => void;
    children: ReactNode;
}

export function ProviderHeader({
    index,
    name,
    badge,
    enabled,
    toggleDisabled,
    onToggleEnabled,
    children,
}: ProviderHeaderProps) {
    const { t } = useTranslation();
    return (
        <SettingsPage
            index={index}
            title={name}
            badge={badge}
            actions={
                <>
                    <span className="text-small text-muted-foreground">
                        {enabled
                            ? t("provider.statusEnabled")
                            : t("provider.statusDisabled")}
                    </span>
                    <Switch
                        checked={enabled}
                        disabled={toggleDisabled}
                        onCheckedChange={onToggleEnabled}
                        aria-label={t("provider.enableProvider")}
                    />
                </>
            }
        >
            {children}
        </SettingsPage>
    );
}
