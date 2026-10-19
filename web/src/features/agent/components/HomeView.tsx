import { useState } from "react";
import { useTranslation } from "react-i18next";

import type {
    ModelOption,
    ModelSelection,
} from "@/features/agent/useModelSelection";

import { ChatComposer } from "./ChatComposer";

interface HomeViewProps {
    onSubmit: (text: string) => void;
    model: ModelSelection | null;
    modelOptions: ModelOption[];
    onModelChange: (selection: ModelSelection) => void;
}

export function HomeView({
    onSubmit,
    model,
    modelOptions,
    onModelChange,
}: HomeViewProps) {
    const { t } = useTranslation();
    const [value, setValue] = useState("");

    return (
        <div className="grid flex-1 place-items-center px-6">
            <div className="w-full max-w-2xl">
                <h1 className="mb-8 text-center text-3xl font-semibold">
                    {t("common.appName")}
                </h1>
                <ChatComposer
                    value={value}
                    onChange={setValue}
                    onSend={() => onSubmit(value.trim())}
                    model={model}
                    modelOptions={modelOptions}
                    onModelChange={onModelChange}
                />
            </div>
        </div>
    );
}
