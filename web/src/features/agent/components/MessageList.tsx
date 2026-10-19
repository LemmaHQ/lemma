import { useEffect, useMemo, useRef } from "react";

import type { AgentItem } from "@/features/agent/store";

import { EmptyState } from "./EmptyState";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
    items: AgentItem[];
    resetKey: string | null;
    providerNameById: Map<string, string>;
    onPickSuggestion: (text: string) => void;
    onRegenerate: (messageId: string) => void;
}

export function MessageList({
    items,
    resetKey,
    providerNameById,
    onPickSuggestion,
    onRegenerate,
}: MessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = scrollRef.current;
        if (el !== null) {
            el.scrollTop = el.scrollHeight;
        }
        // oxlint-disable-next-line react/exhaustive-effect-dependencies -- items and resetKey are deliberate scroll triggers
    }, [items, resetKey]);

    const lastAssistantId = useMemo(
        () => items.findLast((m) => m.role === "assistant")?.id ?? null,
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

    return (
        <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} className="h-full overflow-y-auto">
                {items.length === 0 ? (
                    <EmptyState onPickSuggestion={onPickSuggestion} />
                ) : (
                    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pt-16 pb-6">
                        {items.map((m) => (
                            <MessageItem
                                key={m.id}
                                message={m}
                                source={sourceOf(m)}
                                canRegenerate={m.id === lastAssistantId}
                                onRegenerate={onRegenerate}
                            />
                        ))}
                    </div>
                )}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-background to-transparent" />
        </div>
    );
}
