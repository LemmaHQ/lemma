import {
    Reasoning,
    ReasoningContent,
    ReasoningTrigger,
} from "@lemma/ui/components/ai-elements/reasoning";
import { ThinkingLoader } from "@lemma/ui/components/ai-elements/thinking-loader";

import type { AgentItem } from "@/features/agent/agent-item";

interface MessageThinkingProps {
    message: AgentItem;
    streaming: boolean;
}

export function MessageThinking({ message, streaming }: MessageThinkingProps) {
    const pending =
        streaming &&
        message.thinking === "" &&
        message.content === "" &&
        message.toolCalls.length === 0;
    if (pending) {
        return <ThinkingLoader />;
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
            <ReasoningTrigger />
            <ReasoningContent>{message.thinking}</ReasoningContent>
        </Reasoning>
    );
}
