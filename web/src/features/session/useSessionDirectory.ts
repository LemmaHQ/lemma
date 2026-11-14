import { create } from "zustand";

import { type StoredCodec, useStoredValue } from "@/features/preferences";
import { getPlatform } from "@/platform/platform";

import type { SessionSummary } from "./grouping";
import { useSessionStore } from "./store";

const MAX_RECENT_DIRECTORIES = 8;

export interface SessionDirectoryState {
    directory: string | undefined;
    selectDirectory: (dir: string | undefined) => void;
    pickDirectory: () => Promise<string | undefined>;
    recentDirectories: string[];
    canPickDirectory: boolean;
}

const useSelectedDirectoryStore = create<{
    selected: string | undefined;
    setSelected: (selected: string | undefined) => void;
}>()((set) => ({
    selected: undefined,
    setSelected: (selected) => set({ selected }),
}));

const RECENT_DIRECTORIES_CODEC: StoredCodec<string[]> = {
    parse: (raw) => {
        if (raw === null) {
            return [];
        }
        try {
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            const seen = new Set<string>();
            const result: string[] = [];
            for (const item of parsed) {
                if (
                    typeof item === "string" &&
                    item !== "" &&
                    !seen.has(item)
                ) {
                    seen.add(item);
                    result.push(item);
                }
            }
            return result;
        } catch {
            return [];
        }
    },
    serialize: (directories) => JSON.stringify(directories),
};
function mergeRecentDirectories(
    stored: string[],
    sessions: SessionSummary[],
): string[] {
    const seen = new Set(stored);
    const merged = [...stored];
    const byRecent = sessions.toSorted((a, b) => b.updatedAtMs - a.updatedAtMs);
    for (const session of byRecent) {
        const dir = session.directory;
        if (dir !== undefined && dir !== "" && !seen.has(dir)) {
            seen.add(dir);
            merged.push(dir);
        }
    }
    return merged;
}

/** Bound directory for session `id`, or shared New Session directory selection with recent-folder history. */
export function useSessionDirectory(
    id: string | null = null,
): SessionDirectoryState {
    const sessions = useSessionStore((s) => s.list);
    const selected = useSelectedDirectoryStore((s) => s.selected);
    const setSelected = useSelectedDirectoryStore((s) => s.setSelected);
    const [storedRecent, setStoredRecent] = useStoredValue(
        "lemma.recentDirectories",
        RECENT_DIRECTORIES_CODEC,
    );
    const picker = getPlatform().directoryPicker;
    const canPickDirectory = picker !== null;

    const selectDirectory = (dir: string | undefined) => {
        const next = dir === undefined || dir === "" ? undefined : dir;
        setSelected(next);
        if (next === undefined) {
            return;
        }
        setStoredRecent(
            [next, ...storedRecent.filter((item) => item !== next)].slice(
                0,
                MAX_RECENT_DIRECTORIES,
            ),
        );
    };
    const pickDirectory = async (): Promise<string | undefined> => {
        if (picker === null) {
            return undefined;
        }
        const picked = await picker.pick();
        if (picked === null || picked === "") {
            return undefined;
        }
        selectDirectory(picked);
        return picked;
    };

    const sessionDirectory =
        id === null ? undefined : sessions.find((c) => c.id === id)?.directory;

    return {
        directory: id === null ? selected : sessionDirectory,
        selectDirectory,
        pickDirectory,
        recentDirectories: mergeRecentDirectories(storedRecent, sessions),
        canPickDirectory,
    };
}
