import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    Message,
    MessageAction,
    MessageActions,
    MessageContent,
    MessageResponse,
} from "@lemma/ui/components/ai-elements/message";
import { CopyIcon } from "@lemma/ui/icons/copy";
import { RefreshCwIcon } from "@lemma/ui/icons/refresh-cw";
import type { AgentItem } from "@/features/agent/agent-item";

import { MessageThinking } from "./MessageThinking";
import { ToolCallList } from "./ToolCallList";

const STREAMDOWN_PLUGINS = { code, cjk };
const STREAMDOWN_ANIMATION = {
    animation: "answerBlurIn",
    duration: 420,
    easing: "var(--motion-easing-enter)",
} as const;

interface MessageItemProps {
    message: AgentItem;
    source?: string | undefined;
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
    const [regenerateKey, setRegenerateKey] = useState(0);

    const streaming = message.status === "streaming";
    const pendingThinking =
        streaming &&
        message.thinking === "" &&
        message.content === "" &&
        message.toolCalls.length === 0;
    const responseAnimating = streaming && !pendingThinking;

    useEffect(() => {
        if (!copied) {
            return;
        }
        const timeout = window.setTimeout(() => setCopied(false), 1500);
        return () => window.clearTimeout(timeout);
    }, [copied]);

    if (message.role === "tool") {
        return null;
    }

    if (message.role === "user") {
        return (
            <Message from="user">
                <MessageContent className="whitespace-pre-wrap">
                    {message.content}
                </MessageContent>
            </Message>
        );
    }

    const handleCopy = async () => {
        await navigator.clipboard.writeText(message.content).catch(() => {});
        setCopied(true);
    };

    const handleRegenerate = () => {
        setRegenerateKey((key) => key + 1);
        onRegenerate?.(message.id);
    };

    return (
        <Message className="ai-answer" from="assistant">
            <MessageContent>
                <MessageThinking message={message} streaming={streaming} />
                <MessageResponse
                    animated={responseAnimating ? STREAMDOWN_ANIMATION : false}
                    caret="circle"
                    className="ai-answer-response"
                    plugins={STREAMDOWN_PLUGINS}
                    isAnimating={responseAnimating}
                >
                    {message.content}
                </MessageResponse>
                {message.toolCalls.length > 0 && (
                    <ToolCallList calls={message.toolCalls} />
                )}
                {message.status === "error" && (
                    <p className="text-destructive">
                        {t("errors.agentFailed")}
                        {message.error !== undefined &&
                            message.error !== "" && (
                                <span className="block text-xs text-muted-foreground">
                                    {message.error}
                                </span>
                            )}
                    </p>
                )}
                {message.status === "aborted" && (
                    <p className="text-xs text-muted-foreground">
                        {t("agent.abortedNotice")}
                    </p>
                )}
            </MessageContent>
            {!streaming && (
                <MessageActions>
                    <MessageAction
                        tooltip={
                            copied
                                ? t("conversation.copied")
                                : t("conversation.copy")
                        }
                        onClick={() => {
                            void handleCopy();
                        }}
                    >
                        <span
                            className="ai-answer-copy-icon"
                            aria-hidden="true"
                        >
                            <span
                                className="ai-answer-copy-layer"
                                data-on={!copied}
                            >
                                <CopyIcon />
                            </span>
                            <span
                                className="ai-answer-copy-layer"
                                data-on={copied}
                            >
                                <svg
                                    className="ai-answer-check"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        key={copied ? "copied" : "copy"}
                                        className="animate-draw"
                                        d="m4 12 5 5L20 6"
                                        pathLength={1}
                                    />
                                </svg>
                            </span>
                        </span>
                    </MessageAction>
                    {canRegenerate === true && onRegenerate !== undefined && (
                        <MessageAction
                            tooltip={t("conversation.regenerate")}
                            onClick={handleRegenerate}
                        >
                            <span
                                key={regenerateKey}
                                className="ai-answer-regenerate-icon"
                                data-spin={regenerateKey > 0}
                            >
                                <RefreshCwIcon />
                            </span>
                        </MessageAction>
                    )}
                    {source !== undefined && source !== "" && (
                        <span className="text-xs text-muted-foreground">
                            {source}
                        </span>
                    )}
                </MessageActions>
            )}
        </Message>
    );
}
