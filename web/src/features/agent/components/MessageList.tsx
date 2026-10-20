import { useMemo } from "react";

import {
    Conversation,
    ConversationContent,
    ConversationFollow,
    ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AgentItem } from "@/features/agent/store";

import { EmptyState } from "./EmptyState";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
    items: AgentItem[];
    conversationId: string | null;
    providerNameById: Map<string, string>;
    onPickSuggestion: (text: string) => void;
    onRegenerate: (messageId: string) => void;
}

export function MessageList({
    items,
    conversationId,
    providerNameById,
    onPickSuggestion,
    onRegenerate,
}: MessageListProps) {
    const lastAssistantId = useMemo(
        () => items.findLast((m) => m.role === "assistant")?.id ?? null,
        [items],
    );
    const lastUserId = useMemo(
        () => items.findLast((m) => m.role === "user")?.id ?? null,
        [items],
    );

    const sourceOf = (m: AgentItem): string | undefined => {
        if (m.model === "") {
            return undefined;
        }
        const name = providerNameById.get(m.providerId);
        return name !== undefined && name !== ""
            ? `${name} · ${m.model}`
            : m.model;
    };

    if (items.length === 0) {
        return (
            <ScrollArea className="min-h-0 flex-1">
                <EmptyState onPickSuggestion={onPickSuggestion} />
            </ScrollArea>
        );
    }

    return (
        <Conversation key={conversationId}>
            <ConversationContent className="mx-auto w-full max-w-3xl space-y-8 px-6 pt-4 pb-6">
                {items.map((m) => (
                    <MessageItem
                        key={m.id}
                        message={m}
                        source={sourceOf(m)}
                        canRegenerate={m.id === lastAssistantId}
                        onRegenerate={onRegenerate}
                    />
                ))}
            </ConversationContent>
            <ConversationScrollButton />
            <ConversationFollow trigger={lastUserId} />
        </Conversation>
    );
}
