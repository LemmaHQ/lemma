import { useLayoutEffect, useMemo, useRef, type UIEvent } from "react";
import { useTranslation } from "react-i18next";

import {
    Session,
    SessionContent,
    SessionFollow,
    SessionScrollButton,
    ScrollArea,
} from "@lemma/ui";
import type { AgentItem } from "../agent-item";

import { EmptyState } from "./EmptyState";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
    items: AgentItem[];
    sessionId: string | null;
    hasMore: boolean;
    providerNameById: Map<string, string>;
    onLoadMore: () => Promise<void>;
    onPickSuggestion: (text: string) => void;
    onRegenerate: (messageId: string) => void;
}

export function MessageList({
    items,
    sessionId,
    hasMore,
    providerNameById,
    onLoadMore,
    onPickSuggestion,
    onRegenerate,
}: MessageListProps) {
    const { t } = useTranslation();
    const prepend = useRef<{
        element: HTMLDivElement;
        sessionId: string | null;
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
        if (pending.sessionId === sessionId) {
            pending.element.scrollTop =
                pending.scrollTop +
                pending.element.scrollHeight -
                pending.scrollHeight;
        }
    }, [sessionId, firstId]);

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
            sessionId,
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
        <Session key={sessionId} onScrollCapture={handleScrollCapture}>
            <SessionContent>
                {items.map((m) => (
                    <MessageItem
                        key={m.id}
                        message={m}
                        source={sourceOf(m)}
                        canRegenerate={m.id === lastAssistantId}
                        onRegenerate={onRegenerate}
                    />
                ))}
            </SessionContent>
            <SessionScrollButton label={t("session.scrollToBottom")} />
            <SessionFollow trigger={lastUserId} />
        </Session>
    );
}
