import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import {
    PromptInput,
    PromptInputBody,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import type {
    ModelOption,
    ModelSelection,
} from "@/features/agent/useModelSelection";

import { ModelSwitcher } from "./ModelSwitcher";

interface ChatComposerProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onStop?: () => void;
    streaming?: boolean;
    model: ModelSelection | null;
    modelOptions: ModelOption[];
    onModelChange: (selection: ModelSelection) => void;
    inputRef?: RefObject<HTMLTextAreaElement | null>;
}

export function ChatComposer({
    value,
    onChange,
    onSend,
    onStop,
    streaming = false,
    model,
    modelOptions,
    onModelChange,
    inputRef,
}: ChatComposerProps) {
    const { t } = useTranslation();
    const canSend = model !== null && value.trim() !== "" && !streaming;

    return (
        <div className="flex flex-col gap-2">
            <PromptInput
                onSubmit={() => {
                    if (canSend) {
                        onSend();
                    }
                }}
            >
                <PromptInputBody>
                    <PromptInputTextarea
                        ref={inputRef}
                        value={value}
                        onChange={(e) => onChange(e.currentTarget.value)}
                        disabled={model === null}
                        placeholder={
                            model === null
                                ? t("chat.noModelPlaceholder")
                                : t("chat.inputPlaceholder")
                        }
                        aria-label={t("chat.inputPlaceholder")}
                    />
                </PromptInputBody>
                <PromptInputFooter>
                    <PromptInputTools>
                        <ModelSwitcher
                            selection={model}
                            options={modelOptions}
                            onSelect={onModelChange}
                        />
                    </PromptInputTools>
                    {streaming ? (
                        <PromptInputSubmit
                            status="streaming"
                            type="button"
                            onClick={onStop}
                            aria-label={t("chat.stop")}
                        />
                    ) : (
                        <PromptInputSubmit
                            disabled={!canSend}
                            aria-label={t("chat.send")}
                        />
                    )}
                </PromptInputFooter>
            </PromptInput>
            <p className="text-center text-xs text-muted-foreground">
                {model === null ? (
                    <>
                        {t("chat.noModelHint")}{" "}
                        <Button
                            variant="link"
                            size="xs"
                            nativeButton={false}
                            render={<Link to="/settings/providers" />}
                        >
                            {t("chat.noModelAction")}
                        </Button>
                    </>
                ) : (
                    t("chat.disclaimer")
                )}
            </p>
        </div>
    );
}
