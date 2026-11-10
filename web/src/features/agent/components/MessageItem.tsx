import { useTranslation } from "react-i18next";

import {
    Alert,
    AlertDescription,
    AlertTitle,
    Message,
    MessageActions,
    MessageContent,
    MessageCopyAction,
    MessageRegenerateAction,
    MessageResponse,
} from "@lemma/ui";
import { type AgentItem, replyView } from "../agent-item";

import { MessageThinking } from "./MessageThinking";
import { ToolCallList } from "./ToolCallList";

interface MessageItemProps {
    message: AgentItem;
    source?: string | undefined;
    onRegenerate?: ((id: string) => void) | undefined;
}

export function MessageItem({
    message,
    source,
    onRegenerate,
}: MessageItemProps) {
    const { t } = useTranslation();

    const view = replyView(message);

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
                <MessageThinking
                    message={message}
                    streaming={view !== "settled"}
                />
                <MessageResponse isAnimating={view === "streaming"}>
                    {message.content}
                </MessageResponse>
                {message.toolCalls.length > 0 && (
                    <ToolCallList calls={message.toolCalls} />
                )}
                {message.status === "error" && (
                    <Alert variant="destructive">
                        <AlertTitle>{t("errors.agentFailed")}</AlertTitle>
                        {message.error !== undefined && (
                            <AlertDescription>{message.error}</AlertDescription>
                        )}
                    </Alert>
                )}
                {message.status === "aborted" && (
                    <p className="text-caption text-subtle-foreground">
                        {t("agent.abortedNotice")}
                    </p>
                )}
            </MessageContent>
            {view === "settled" && (
                <MessageActions>
                    {message.content !== "" && (
                        <MessageCopyAction
                            text={message.content}
                            label={t("common.copy")}
                            copiedLabel={t("common.copied")}
                        />
                    )}
                    {onRegenerate !== undefined && (
                        <MessageRegenerateAction
                            label={t("session.regenerate")}
                            onRegenerate={() => onRegenerate(message.id)}
                        />
                    )}
                    {source !== undefined && (
                        <span className="text-caption text-subtle-foreground">
                            {source}
                        </span>
                    )}
                </MessageActions>
            )}
        </Message>
    );
}
