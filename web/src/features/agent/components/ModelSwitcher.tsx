import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
    ModelOption,
    ModelSelection,
} from "@/features/agent/useModelSelection";
import { cn } from "@/lib/utils";

interface ModelSwitcherProps {
    selection: ModelSelection | null;
    options: ModelOption[];
    onSelect: (selection: ModelSelection) => void;
}

export function ModelSwitcher({
    selection,
    options,
    onSelect,
}: ModelSwitcherProps) {
    const { t } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    aria-label={t("chat.selectModel")}
                    title={t("chat.selectModel")}
                    disabled={options.length === 0}
                >
                    <span className="max-w-56 truncate font-mono">
                        {selection ? selection.model : t("chat.noProvider")}
                    </span>
                    <ChevronDown className="size-3" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {options.map((o) => (
                    <DropdownMenuItem
                        key={`${o.providerId}/${o.model}`}
                        onClick={() =>
                            onSelect({
                                providerId: o.providerId,
                                model: o.model,
                            })
                        }
                        className={cn(
                            "font-mono text-xs",
                            selection?.providerId === o.providerId &&
                                selection.model === o.model &&
                                "bg-accent",
                        )}
                    >
                        {o.providerName} · {o.model}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
