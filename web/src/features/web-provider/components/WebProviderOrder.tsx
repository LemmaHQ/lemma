import {
    Button,
    ChevronDownIcon,
    ChevronUpIcon,
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
        <section>
            <h2 className="text-title">{title}</h2>
            <p className="mt-1 text-small text-muted-foreground">
                {description}
            </p>
            <ol className="mt-4 flex flex-col gap-2 rounded-lg border p-2">
                {providers.map((provider, index) => (
                    <li
                        key={provider.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1"
                    >
                        <span>{provider.name}</span>
                        <div className="ml-auto flex gap-1">
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
                        </div>
                    </li>
                ))}
            </ol>
        </section>
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
