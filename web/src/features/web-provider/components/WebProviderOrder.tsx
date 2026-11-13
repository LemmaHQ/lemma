import {
    Button,
    ChevronDownIcon,
    ChevronUpIcon,
    SettingsRow,
    SettingsSection,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

import type { WebProvider } from "../store";

interface WebProviderOrderProps {
    title: string;
    description: string;
    providers: WebProvider[];
    onMove: (index: number, direction: -1 | 1) => void;
}

export function WebProviderOrder({
    title,
    description,
    providers,
    onMove,
}: WebProviderOrderProps) {
    const { t } = useTranslation();
    return (
        <SettingsSection
            title={title}
            actions={
                <span className="text-small text-muted-foreground">
                    {description}
                </span>
            }
        >
            {providers.map((provider, index) => (
                <SettingsRow key={provider.id} label={provider.name}>
                    <MoveButton
                        direction="up"
                        label={t("provider.webMoveUp", {
                            name: provider.name,
                        })}
                        disabled={index === 0}
                        onClick={() => onMove(index, -1)}
                    />
                    <MoveButton
                        direction="down"
                        label={t("provider.webMoveDown", {
                            name: provider.name,
                        })}
                        disabled={index === providers.length - 1}
                        onClick={() => onMove(index, 1)}
                    />
                </SettingsRow>
            ))}
        </SettingsSection>
    );
}

interface MoveButtonProps {
    direction: "up" | "down";
    label: string;
    disabled: boolean;
    onClick: () => void;
}

function MoveButton({ direction, label, disabled, onClick }: MoveButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={label}
                        disabled={disabled}
                        onClick={onClick}
                    />
                }
            >
                {direction === "up" ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
