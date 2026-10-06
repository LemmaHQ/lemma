import { Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { MessageContent, ThinkingBlock, ToolCallCard } from "./MessageContent";
import { Button } from "@/components/ui/button";
import type { AgentItem } from "@/features/agent/store";

interface MessageItemProps {
    message: AgentItem;
    source?: string;
    canRegenerate?: boolean;
    onRegenerate?: (id: string) => void;
}

export function MessageItem({
    message,
    source,
    canRegenerate,
    onRegenerate,
}: MessageItemProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const streaming = message.status === "streaming";

    if (message.role === "tool") {
        return null;
    }

    if (message.role === "user") {
        return (
            <div className="flex justify-end">
                <div className="max-w-[75%] rounded-xl bg-muted px-4 py-2.5 text-sm wrap-break-word whitespace-pre-wrap">
                    {message.content}
                </div>
            </div>
        );
    }

    const handleCopy = async () => {
        await navigator.clipboard
            .writeText(message.content)
            .catch(() => undefined);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="flex gap-3">
            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-background">
                <Sparkles className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1">
                {message.thinking && (
                    <ThinkingBlock
                        thinking={message.thinking}
                        streaming={streaming}
                    />
                )}
                <MessageContent content={message.content} />
                {message.toolCalls.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {message.toolCalls.map((call) => (
                            <ToolCallCard key={call.id} call={call} />
                        ))}
                    </div>
                )}
                {streaming && (
                    <span className="mt-1 inline-block h-4 w-1.75 animate-pulse rounded-[1px] bg-foreground/70 align-text-bottom" />
                )}
                {message.status === "error" && message.error && (
                    <p className="mt-2 text-sm text-destructive">
                        {message.error}
                    </p>
                )}
                {message.status === "aborted" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        {t("chat.abortedNotice")}
                    </p>
                )}
                {!streaming && source && (
                    <p className="mt-3 text-xs text-muted-foreground">
                        {source}
                    </p>
                )}
                {!streaming && (
                    <div className="mt-2 flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-7 text-muted-foreground"
                            onClick={handleCopy}
                            aria-label={
                                copied ? t("chat.copied") : t("chat.copy")
                            }
                        >
                            {copied ? (
                                <Check className="size-3.5" />
                            ) : (
                                <Copy className="size-3.5" />
                            )}
                        </Button>
                        {canRegenerate && onRegenerate && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-7 text-muted-foreground"
                                onClick={() => onRegenerate(message.id)}
                                aria-label={t("chat.regenerate")}
                            >
                                <RefreshCw className="size-3.5" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
