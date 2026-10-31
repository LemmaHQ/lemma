import { useLayoutEffect, useMemo, useRef, type UIEvent } from "react";
import { useTranslation } from "react-i18next";

import {
    Conversation,
    ConversationContent,
    ConversationFollow,
    ConversationScrollButton,
    ScrollArea,
} from "@lemma/ui";
import type { AgentItem } from "../agent-item";

import { EmptyState } from "./EmptyState";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
    items: AgentItem[];
    conversationId: string | null;
    hasMore: boolean;
    providerNameById: Map<string, string>;
    onLoadMore: () => Promise<void>;
    onPickSuggestion: (text: string) => void;
    onRegenerate: (messageId: string) => void;
}

export function MessageList({
    items,
    conversationId,
    hasMore,
    providerNameById,
    onLoadMore,
    onPickSuggestion,
    onRegenerate,
}: MessageListProps) {
    const { t } = useTranslation();
    const prepend = useRef<{
        element: HTMLDivElement;
        conversationId: string | null;
        firstId: string | undefined;
        scrollHeight: number;
        scrollTop: number;
    } | null>(null);
    const firstId = items.at(0)?.id;
    const lastAssistantId = useMemo(
        () => items.findLast((m) => m.role === "assistant")?.id ?? null,
        [items],
    );
    const lastUserId = useMemo(
        () => items.findLast((m) => m.role === "user")?.id ?? null,
        [items],
    );

    useLayoutEffect(() => {
        const pending = prepend.current;
        if (pending === null || pending.firstId === firstId) {
            return;
        }
        prepend.current = null;
        if (pending.conversationId === conversationId) {
            pending.element.scrollTop =
                pending.scrollTop +
                pending.element.scrollHeight -
                pending.scrollHeight;
        }
    }, [conversationId, firstId]);

    const handleScrollCapture = (event: UIEvent<HTMLDivElement>) => {
        const element = event.target;
        if (
            !(element instanceof HTMLDivElement) ||
            element.dataset["slot"] !== "scroll-area-viewport" ||
            element.scrollTop > 0 ||
            !hasMore
        ) {
            return;
        }
        prepend.current = {
            element,
            conversationId,
            firstId,
            scrollHeight: element.scrollHeight,
            scrollTop: element.scrollTop,
        };
        void onLoadMore().catch(() => {
            prepend.current = null;
        });
    };

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
        <Conversation
            key={conversationId}
            onScrollCapture={handleScrollCapture}
        >
            <ConversationContent>
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
            <ConversationScrollButton
                label={t("conversation.scrollToBottom")}
            />
            <ConversationFollow trigger={lastUserId} />
        </Conversation>
    );
}
