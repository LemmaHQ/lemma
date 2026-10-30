import {
    Reasoning,
    ReasoningContent,
    ReasoningTrigger,
    ThinkingLoader,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

import type { AgentItem } from "../agent-item";

interface MessageThinkingProps {
    message: AgentItem;
    streaming: boolean;
}

export function MessageThinking({ message, streaming }: MessageThinkingProps) {
    const { t } = useTranslation();
    const pending =
        streaming &&
        message.thinking === "" &&
        message.content === "" &&
        message.toolCalls.length === 0;
    if (pending) {
        return <ThinkingLoader label={t("agent.thinkingPending")} />;
    }
    if (message.thinking === "") {
        return null;
    }
    return (
        <Reasoning
            defaultOpen={streaming}
            finishedAt={message.thinkingFinishedAt}
            isStreaming={
                streaming &&
                message.content === "" &&
                message.thinkingFinishedAt === undefined
            }
            startedAt={message.thinkingStartedAt}
        >
            <ReasoningTrigger
                labels={{
                    thinking: t("agent.thinkingInProgress"),
                    thought: t("agent.thinking"),
                    thoughtFor: (duration) =>
                        t("agent.thoughtFor", { duration }),
                }}
            />
            <ReasoningContent>{message.thinking}</ReasoningContent>
        </Reasoning>
    );
}
