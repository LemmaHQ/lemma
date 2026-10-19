import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
    ModelSelector,
    ModelSelectorContent,
    ModelSelectorEmpty,
    ModelSelectorGroup,
    ModelSelectorInput,
    ModelSelectorItem,
    ModelSelectorList,
    ModelSelectorName,
    ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import type {
    ModelOption,
    ModelSelection,
} from "@/features/agent/useModelSelection";

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
    const [open, setOpen] = useState(false);
    const groups = [...Map.groupBy(options, (o) => o.providerName)];

    return (
        <ModelSelector open={open} onOpenChange={setOpen}>
            <ModelSelectorTrigger
                render={
                    <PromptInputButton
                        aria-label={t("chat.selectModel")}
                        disabled={options.length === 0}
                    />
                }
            >
                <ModelSelectorName>
                    {selection === null
                        ? t("chat.noProvider")
                        : selection.model}
                </ModelSelectorName>
                <IconChevronDown />
            </ModelSelectorTrigger>
            <ModelSelectorContent title={t("chat.selectModel")}>
                <ModelSelectorInput placeholder={t("chat.searchModel")} />
                <ModelSelectorList>
                    <ModelSelectorEmpty>
                        {t("chat.noModelMatch")}
                    </ModelSelectorEmpty>
                    {groups.map(([providerName, models]) => (
                        <ModelSelectorGroup
                            key={providerName}
                            heading={providerName}
                        >
                            {models.map((o) => (
                                <ModelSelectorItem
                                    key={`${o.providerId}/${o.model}`}
                                    value={`${o.providerName} ${o.model}`}
                                    onSelect={() => {
                                        onSelect({
                                            providerId: o.providerId,
                                            model: o.model,
                                        });
                                        setOpen(false);
                                    }}
                                >
                                    <ModelSelectorName>
                                        {o.model}
                                    </ModelSelectorName>
                                    {selection?.providerId === o.providerId &&
                                        selection.model === o.model && (
                                            <IconCheck />
                                        )}
                                </ModelSelectorItem>
                            ))}
                        </ModelSelectorGroup>
                    ))}
                </ModelSelectorList>
            </ModelSelectorContent>
        </ModelSelector>
    );
}
