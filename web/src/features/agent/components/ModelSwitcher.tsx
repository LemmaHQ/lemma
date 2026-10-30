import { ModelPicker } from "@lemma/ui";
import { useTranslation } from "react-i18next";

import type { ModelOption, ModelSelection } from "../useModelSelection";

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
        <ModelPicker
            selection={selection}
            options={options}
            onSelect={onSelect}
            label={t("conversation.selectModel")}
            placeholder={t("conversation.noProvider")}
        />
    );
}
