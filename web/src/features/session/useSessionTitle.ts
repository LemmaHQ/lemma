import { useSessionStore } from "./store";

/** The stored title of session `id`; `undefined` for a `null` id or while the list does not hold it. */
export function useSessionTitle(id: string | null): string | undefined {
    return useSessionStore((s) => s.list.find((c) => c.id === id)?.title);
}
