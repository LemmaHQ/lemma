import { ModelPicker } from "@lemma/ui/components/ai-elements/model-picker";

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
    return (
        <ModelPicker
            selection={selection}
            options={options}
            onSelect={onSelect}
        />
    );
}
