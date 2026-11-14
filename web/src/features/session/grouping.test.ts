import { describe, expect, it } from "vitest";

import {
    directoryBasename,
    formatSessionTime,
    groupSessions,
    type SessionSummary,
    VISIBLE_SESSION_LIMIT,
    visibleDirectorySessions,
} from "./grouping";

const mk = (
    id: string,
    updatedAtMs: number,
    directory?: string,
): SessionSummary => ({
    id,
    title: id,
    updatedAtMs,
    ...(directory === undefined ? {} : { directory }),
});

describe("groupSessions", () => {
    it("groups sessions by directory ordered by newest activity", () => {
        const groups = groupSessions([
            mk("a1", 100, "/work/alpha"),
            mk("d1", 300),
            mk("b1", 200, "/work/beta"),
            mk("a2", 400, "/work/alpha"),
            mk("d2", 50),
        ]);

        expect(
            groups.map((g) => ({
                directory: g.directory,
                ids: g.items.map((s) => s.id),
            })),
        ).toEqual([
            { directory: "/work/alpha", ids: ["a2", "a1"] },
            { directory: "", ids: ["d1", "d2"] },
            { directory: "/work/beta", ids: ["b1"] },
        ]);
    });

    it("returns an empty array for no sessions", () => {
        expect(groupSessions([])).toEqual([]);
    });
});

describe("directoryBasename", () => {
    it("returns the default label for an unbound directory", () => {
        expect(directoryBasename("", "Default workspace")).toBe(
            "Default workspace",
        );
    });

    it("extracts the last segment for POSIX and Windows paths", () => {
        expect(directoryBasename("/Users/alice/lemma", "Default")).toBe(
            "lemma",
        );
        expect(directoryBasename("C:\\work\\project\\", "Default")).toBe(
            "project",
        );
    });

    it("falls back to the original string when no segments exist", () => {
        expect(directoryBasename("/", "Default")).toBe("/");
    });
});

describe("visibleDirectorySessions", () => {
    it("shows all items when five or fewer exist", () => {
        const items = [1, 2, 3, 4, 5].map((n) => mk(`s${n}`, n));
        expect(visibleDirectorySessions(items, false)).toEqual({
            visible: items,
            hiddenCount: 0,
        });
    });

    it("shows the first four items and counts hidden items for six or more", () => {
        const items = [1, 2, 3, 4, 5, 6].map((n) => mk(`s${n}`, n));
        expect(visibleDirectorySessions(items, false)).toEqual({
            visible: items.slice(0, VISIBLE_SESSION_LIMIT),
            hiddenCount: 2,
        });
    });

    it("shows all items when expanded", () => {
        const items = [1, 2, 3, 4, 5, 6, 7].map((n) => mk(`s${n}`, n));
        expect(visibleDirectorySessions(items, true)).toEqual({
            visible: items,
            hiddenCount: 0,
        });
    });
});

describe("formatSessionTime", () => {
    const now = new Date(2026, 5, 15, 14, 30, 0).getTime();

    it("returns empty string for zero or negative timestamps", () => {
        expect(formatSessionTime(0, now)).toBe("");
        expect(formatSessionTime(-1, now)).toBe("");
    });

    it("formats same-day timestamps as HH:mm", () => {
        const morning = new Date(2026, 5, 15, 9, 5, 0).getTime();
        expect(formatSessionTime(morning, now)).toBe("09:05");
    });

    it("formats same-year earlier days as MM-DD", () => {
        const earlier = new Date(2026, 2, 9, 18, 0, 0).getTime();
        expect(formatSessionTime(earlier, now)).toBe("03-09");
    });

    it("formats previous-year timestamps as YYYY-MM-DD", () => {
        const older = new Date(2025, 11, 31, 23, 59, 0).getTime();
        expect(formatSessionTime(older, now)).toBe("2025-12-31");
    });
});
