import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ModelOption, ModelSelection } from "../useModelSelection";

import { MessageComposer } from "./MessageComposer";

interface HomeViewProps {
    onSubmit: (text: string) => void;
    model: ModelSelection | null;
    modelOptions: ModelOption[];
    onModelChange: (selection: ModelSelection) => void;
    providersPath: string;
}

export function HomeView({
    onSubmit,
    model,
    modelOptions,
    onModelChange,
    providersPath,
}: HomeViewProps) {
    const { t } = useTranslation();
    const [value, setValue] = useState("");

    return (
        <div className="grid flex-1 place-items-center px-4 md:px-6">
            <div className="w-full max-w-3xl">
                <h1 className="mb-8 text-center text-display">
                    {t("common.appName")}
                </h1>
                <MessageComposer
                    value={value}
                    onChange={setValue}
                    onSend={() => onSubmit(value.trim())}
                    model={model}
                    modelOptions={modelOptions}
                    onModelChange={onModelChange}
                    providersPath={providersPath}
                />
            </div>
        </div>
    );
}
