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
import { Button } from "@lemma/ui/components/button";
import type {
    ModelOption,
    ModelSelection,
} from "@/features/agent/useModelSelection";

import { ModelSwitcher } from "./ModelSwitcher";

interface MessageComposerProps {
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

export function MessageComposer({
    value,
    onChange,
    onSend,
    onStop,
    streaming = false,
    model,
    modelOptions,
    onModelChange,
    inputRef,
}: MessageComposerProps) {
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
                                ? t("conversation.noModelPlaceholder")
                                : t("conversation.inputPlaceholder")
                        }
                        aria-label={t("conversation.inputPlaceholder")}
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
                            aria-label={t("agent.stop")}
                        />
                    ) : (
                        <PromptInputSubmit
                            disabled={!canSend}
                            aria-label={t("conversation.send")}
                        />
                    )}
                </PromptInputFooter>
            </PromptInput>
            <p className="text-center text-xs text-muted-foreground">
                {model === null ? (
                    <>
                        {t("conversation.noModelHint")}{" "}
                        <Button
                            variant="link"
                            size="xs"
                            nativeButton={false}
                            render={
                                <Link to="/settings/providers" viewTransition />
                            }
                        >
                            {t("conversation.noModelAction")}
                        </Button>
                    </>
                ) : (
                    t("conversation.disclaimer")
                )}
            </p>
        </div>
    );
}
