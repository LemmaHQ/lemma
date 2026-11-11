import { useSessionStore } from "./store";

/** The bound directory of session `id`; `undefined` for a `null` id, a generated workspace, or a session absent from the list. */
export function useSessionDirectory(id: string | null): string | undefined {
    return useSessionStore((s) => s.list.find((c) => c.id === id)?.directory);
}
