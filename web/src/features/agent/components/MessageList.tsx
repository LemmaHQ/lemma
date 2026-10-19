import { useEffect, useMemo, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
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
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const viewport = contentRef.current?.closest(
            '[data-slot="scroll-area-viewport"]',
        );
        if (viewport !== null && viewport !== undefined) {
            viewport.scrollTop = viewport.scrollHeight;
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
        <ScrollArea className="min-h-0 flex-1">
            <div ref={contentRef} className="h-full">
                {items.length === 0 ? (
                    <EmptyState onPickSuggestion={onPickSuggestion} />
                ) : (
                    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 pt-4 pb-6">
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
        </ScrollArea>
    );
}
