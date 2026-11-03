import { useTranslation } from "react-i18next";

import {
    Message,
    MessageActions,
    MessageContent,
    MessageCopyAction,
    MessageRegenerateAction,
    MessageResponse,
} from "@lemma/ui";
import type { AgentItem } from "../agent-item";

import { MessageThinking } from "./MessageThinking";
import { ToolCallList } from "./ToolCallList";

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

    const streaming = message.status === "streaming";
    const pendingThinking =
        streaming &&
        message.thinking === "" &&
        message.content === "" &&
        message.toolCalls.length === 0;

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

    return (
        <Message from="assistant">
            <MessageContent>
                <MessageThinking message={message} streaming={streaming} />
                <MessageResponse isAnimating={streaming && !pendingThinking}>
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
                    <MessageCopyAction
                        text={message.content}
                        label={t("common.copy")}
                        copiedLabel={t("common.copied")}
                    />
                    {canRegenerate === true && onRegenerate !== undefined && (
                        <MessageRegenerateAction
                            label={t("session.regenerate")}
                            onRegenerate={() => onRegenerate(message.id)}
                        />
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
