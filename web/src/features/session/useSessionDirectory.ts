import { create } from "zustand";
import { getPlatform } from "@/platform/platform";

import type { SessionSummary } from "./grouping";
import { useSessionStore } from "./store";

const RECENT_DIRECTORIES_KEY = "lemma.recentDirectories";
const MAX_RECENT_DIRECTORIES = 8;

export interface SessionDirectoryState {
    directory: string | undefined;
    selectDirectory: (dir: string | undefined) => void;
    pickDirectory: () => Promise<string | undefined>;
    recentDirectories: string[];
    canPickDirectory: boolean;
}

const useDirectoryStore = create<{
    selected: string | undefined;
    version: number;
    setSelected: (selected: string | undefined) => void;
    bumpRecent: () => void;
}>()((set) => ({
    selected: undefined,
    version: 0,
    setSelected: (selected) => set({ selected }),
    bumpRecent: () => set((s) => ({ version: s.version + 1 })),
}));

function readRecentDirectories(): string[] {
    try {
        const raw = localStorage.getItem(RECENT_DIRECTORIES_KEY);
        if (raw === null) {
            return [];
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        const seen = new Set<string>();
        const result: string[] = [];
        for (const item of parsed) {
            if (typeof item === "string" && item !== "" && !seen.has(item)) {
                seen.add(item);
                result.push(item);
            }
        }
        return result;
    } catch {
        return [];
    }
}

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
    const selected = useDirectoryStore((s) => s.selected);
    const version = useDirectoryStore((s) => s.version);
    const setSelected = useDirectoryStore((s) => s.setSelected);
    const bumpRecent = useDirectoryStore((s) => s.bumpRecent);
    const storedRecent = readRecentDirectories();
    const picker = getPlatform().directoryPicker;
    const canPickDirectory = picker !== null;

    const selectDirectory = (dir: string | undefined) => {
        const next = dir === undefined || dir === "" ? undefined : dir;
        setSelected(next);
        if (next === undefined) {
            return;
        }
        const updated = [
            next,
            ...storedRecent.filter((item) => item !== next),
        ].slice(0, MAX_RECENT_DIRECTORIES);
        localStorage.setItem(RECENT_DIRECTORIES_KEY, JSON.stringify(updated));
        bumpRecent();
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

    void version;

    return {
        directory: id === null ? selected : sessionDirectory,
        selectDirectory,
        pickDirectory,
        recentDirectories: mergeRecentDirectories(storedRecent, sessions),
        canPickDirectory,
    };
}
