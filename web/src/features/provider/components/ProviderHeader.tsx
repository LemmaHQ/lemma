import { Avatar, AvatarFallback, SettingsPage, Switch } from "@lemma/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ProviderHeaderProps {
    name: string;
    enabled: boolean;
    toggleDisabled: boolean;
    onToggleEnabled: (enabled: boolean) => void;
    actions?: ReactNode;
    children: ReactNode;
}

export function ProviderHeader({
    name,
    enabled,
    toggleDisabled,
    onToggleEnabled,
    actions,
    children,
}: ProviderHeaderProps) {
    const { t } = useTranslation();
    return (
        <SettingsPage
            title={name}
            media={
                <Avatar>
                    <AvatarFallback>
                        {name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
            }
            actions={
                <>
                    {actions}
                    <Switch
                        className="ml-2"
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
