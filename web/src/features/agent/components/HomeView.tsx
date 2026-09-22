import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    ModelSwitcher,
    type ModelSelection,
} from "@/components/chat/ModelSwitcher";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface HomeViewProps {
    onSubmit: (text: string) => void;
    model: ModelSelection | null;
    onModelChange: (selection: ModelSelection) => void;
}

function autosize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
}

export function HomeView({ onSubmit, model, onModelChange }: HomeViewProps) {
    const { t } = useTranslation();
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        autosize(textareaRef.current);
    }, [value]);

    const canSend = value.trim().length > 0;
    const submit = () => {
        if (canSend) onSubmit(value.trim());
    };

    return (
        <div className="grid flex-1 place-items-center px-6">
            <div className="w-full max-w-2xl">
                <p className="mb-8 text-center text-headline font-semibold">
                    {t("common.appName")}
                </p>
                <div className="glass rounded-xl border border-border p-4 shadow-composer">
                    <Textarea
                        ref={textareaRef}
                        value={value}
                        rows={2}
                        onChange={(e) => setValue(e.target.value)}
                        onInput={(e) => autosize(e.currentTarget)}
                        onKeyDown={(e) => {
                            if (
                                e.key === "Enter" &&
                                !e.shiftKey &&
                                // Enter during IME composition confirms a
                                // candidate; it must not send.
                                !e.nativeEvent.isComposing
                            ) {
                                e.preventDefault();
                                submit();
                            }
                        }}
                        placeholder={t("chat.inputPlaceholder")}
                        aria-label={t("chat.inputPlaceholder")}
                        className="max-h-48 min-h-16 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                    />
                    <div className="mt-2 flex items-center justify-between">
                        <ModelSwitcher
                            selection={model}
                            onSelect={onModelChange}
                        />
                        <Button
                            size="icon"
                            className={cn(
                                "size-8 rounded-full",
                                canSend
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "bg-secondary text-muted-foreground",
                            )}
                            onClick={submit}
                            disabled={!canSend}
                            aria-label={t("chat.send")}
                        >
                            <ArrowUp className="size-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
