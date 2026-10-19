import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { IconCheck, IconCopy, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
    Message,
    MessageAction,
    MessageActions,
    MessageContent,
    MessageResponse,
} from "@/components/ai-elements/message";
import {
    Reasoning,
    ReasoningContent,
    ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
    Tool,
    ToolContent,
    ToolHeader,
    ToolInput,
    ToolOutput,
} from "@/components/ai-elements/tool";
import type { AgentItem, ToolCallItem } from "@/features/agent/store";

const STREAMDOWN_PLUGINS = { code, cjk };

interface MessageItemProps {
    message: AgentItem;
    source?: string | undefined;
    canRegenerate?: boolean;
    onRegenerate?: (id: string) => void;
}

function parseArguments(text: string): unknown {
    try {
        const value: unknown = JSON.parse(text);
        return value;
    } catch {
        return text;
    }
}

function ToolCall({ call }: { call: ToolCallItem }) {
    const state =
        call.state === "running"
            ? "input-available"
            : call.isError
              ? "output-error"
              : "output-available";
    return (
        <Tool defaultOpen={call.state === "running"}>
            <ToolHeader
                title={call.name}
                type={`tool-${call.name}`}
                state={state}
            />
            <ToolContent>
                <ToolInput input={parseArguments(call.arguments)} />
                {call.state === "done" && (
                    <ToolOutput
                        output={call.isError ? undefined : call.output}
                        errorText={call.isError ? call.output : undefined}
                    />
                )}
            </ToolContent>
        </Tool>
    );
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
        window.setTimeout(() => setCopied(false), 1500);
    };

    return (
        <Message from="assistant">
            <MessageContent>
                {message.thinking !== "" && (
                    <Reasoning
                        isStreaming={streaming && message.content === ""}
                        defaultOpen={streaming}
                    >
                        <ReasoningTrigger
                            getThinkingMessage={(thinking) =>
                                thinking
                                    ? t("chat.thinkingInProgress")
                                    : t("chat.thinking")
                            }
                        />
                        <ReasoningContent>{message.thinking}</ReasoningContent>
                    </Reasoning>
                )}
                <MessageResponse
                    plugins={STREAMDOWN_PLUGINS}
                    isAnimating={streaming}
                    caret="block"
                >
                    {message.content}
                </MessageResponse>
                {message.toolCalls.map((call) => (
                    <ToolCall key={call.id} call={call} />
                ))}
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
                        {t("chat.abortedNotice")}
                    </p>
                )}
            </MessageContent>
            {!streaming && (
                <MessageActions>
                    <MessageAction
                        tooltip={copied ? t("chat.copied") : t("chat.copy")}
                        onClick={() => {
                            void handleCopy();
                        }}
                    >
                        {copied ? <IconCheck /> : <IconCopy />}
                    </MessageAction>
                    {canRegenerate === true && onRegenerate !== undefined && (
                        <MessageAction
                            tooltip={t("chat.regenerate")}
                            onClick={() => onRegenerate(message.id)}
                        >
                            <IconRefresh />
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
