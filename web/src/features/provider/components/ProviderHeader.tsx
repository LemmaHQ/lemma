import { Avatar, AvatarFallback, Switch } from "@lemma/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ProviderHeaderProps {
    name: string;
    enabled: boolean;
    toggleDisabled: boolean;
    onToggleEnabled: (enabled: boolean) => void;
    actions?: ReactNode;
}

export function ProviderHeader({
    name,
    enabled,
    toggleDisabled,
    onToggleEnabled,
    actions,
}: ProviderHeaderProps) {
    const { t } = useTranslation();
    return (
        <header className="flex items-center gap-3">
            <Avatar>
                <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <h2 className="truncate text-title">{name}</h2>
            <div className="ml-auto flex items-center gap-1">
                {actions}
                <Switch
                    className="ml-2"
                    checked={enabled}
                    disabled={toggleDisabled}
                    onCheckedChange={onToggleEnabled}
                    aria-label={t("provider.enableProvider")}
                />
            </div>
        </header>
    );
}
