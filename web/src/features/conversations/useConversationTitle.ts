import { useConversationsStore } from "./store";

/** The stored title of conversation `id`; `undefined` for a `null` id or while the list does not hold it. */
export function useConversationTitle(id: string | null): string | undefined {
    return useConversationsStore((s) => s.list.find((c) => c.id === id)?.title);
}
