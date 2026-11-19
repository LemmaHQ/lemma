import {
    Button,
    cn,
    CopyButton,
    RefreshCwIcon,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

function RegenerateButton({
    disabled,
    onRegenerate,
}: {
    disabled: boolean;
    onRegenerate: () => void;
}) {
    const { t } = useTranslation();
    const [spins, setSpins] = useState(0);
    const label = t("session.regenerate");

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
                        onClick={() => {
                            setSpins((count) => count + 1);
                            onRegenerate();
                        }}
                    />
                }
            >
                <span
                    key={spins}
                    className={cn(
                        "grid place-items-center",
                        spins > 0 && "animate-spin-once",
                    )}
                >
                    <RefreshCwIcon />
                </span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

/**
 * Action row of a settled reply: copy, regenerate (its icon spins once per click), and `meta`.
 * The row stays dimmed until the enclosing `group/turn` is hovered or focused, except on touch screens.
 */
export function TurnReplyActions({
    text,
    meta,
    regenerateDisabled,
    onRegenerate,
}: {
    text: string;
    meta: string | undefined;
    regenerateDisabled: boolean;
    onRegenerate: (() => void) | undefined;
}) {
    const { t } = useTranslation();

    return (
        <div className="stagger-children flex items-center gap-1 text-caption text-subtle-foreground opacity-60 transition-opacity duration-medium ease-enter group-focus-within/turn:opacity-100 group-hover/turn:opacity-100 motion-reduce:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100">
            {text !== "" && (
                <CopyButton
                    text={text}
                    label={t("common.copy")}
                    copiedLabel={t("common.copied")}
                />
            )}
            {onRegenerate !== undefined && (
                <RegenerateButton
                    disabled={regenerateDisabled}
                    onRegenerate={onRegenerate}
                />
            )}
            {meta !== undefined && (
                <span className="ml-1 tabular-nums">{meta}</span>
            )}
        </div>
    );
}
