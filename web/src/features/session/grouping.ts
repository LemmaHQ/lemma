import { formatClockTime } from "@lemma/ui";

export interface SessionSummary {
    id: string;
    title: string;
    updatedAtMs: number;
    directory?: string;
    leafId?: string;
    activeMessageId?: string;
}

export interface DirectoryGroup {
    directory: string;
    items: SessionSummary[];
}

export const VISIBLE_SESSION_LIMIT = 4;
const COLLAPSE_THRESHOLD = 5;

/** Groups sessions by bound directory (`""` for default workspace), newest activity first. */
export function groupSessions(sessions: SessionSummary[]): DirectoryGroup[] {
    const byDirectory = new Map<string, SessionSummary[]>();
    const sorted = sessions.toSorted((a, b) => b.updatedAtMs - a.updatedAtMs);
    for (const session of sorted) {
        const key = session.directory ?? "";
        const items = byDirectory.get(key);
        if (items === undefined) {
            byDirectory.set(key, [session]);
        } else {
            items.push(session);
        }
    }
    return Array.from(byDirectory, ([directory, items]) => ({
        directory,
        items,
    }));
}

/** Terminal path segment of `directory`, or `defaultLabel` when unbound. */
export function directoryBasename(
    directory: string,
    defaultLabel: string,
): string {
    if (directory === "") {
        return defaultLabel;
    }
    return (
        directory.split(/[\\/]/u).findLast((part) => part !== "") ?? directory
    );
}

/** Slices a directory group's sessions unless at most five exist or `expanded` is true. */
export function visibleDirectorySessions(
    items: SessionSummary[],
    expanded: boolean,
): { visible: SessionSummary[]; hiddenCount: number } {
    if (items.length <= COLLAPSE_THRESHOLD || expanded) {
        return { visible: items, hiddenCount: 0 };
    }
    return {
        visible: items.slice(0, VISIBLE_SESSION_LIMIT),
        hiddenCount: items.length - VISIBLE_SESSION_LIMIT,
    };
}

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

/** Compact local timestamp (`HH:mm` today, `MM-DD` same year, `YYYY-MM-DD` older). */
export function formatSessionTime(
    updatedAtMs: number,
    nowMs = Date.now(),
): string {
    if (updatedAtMs <= 0) {
        return "";
    }
    const date = new Date(updatedAtMs);
    const now = new Date(nowMs);
    const sameYear = date.getFullYear() === now.getFullYear();
    const sameDay =
        sameYear &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
    if (sameDay) {
        return formatClockTime(updatedAtMs);
    }
    const monthDay = `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    return sameYear ? monthDay : `${date.getFullYear()}-${monthDay}`;
}
