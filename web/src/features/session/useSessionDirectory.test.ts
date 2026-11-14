import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useSessionStore } from "./store";
import { useSessionDirectory } from "./useSessionDirectory";

const platform = vi.hoisted(() => {
    const state: {
        directoryPicker: { pick: () => Promise<string | null> } | null;
    } = { directoryPicker: null };
    return state;
});

vi.mock("@/platform/platform", () => ({ getPlatform: () => platform }));

beforeEach(() => {
    localStorage.clear();
    platform.directoryPicker = null;
    useSessionStore.setState({
        list: [
            {
                id: "c1",
                title: "Project",
                updatedAtMs: 200,
                directory: "C:\\work\\project",
            },
            { id: "c2", title: "Scratch", updatedAtMs: 300 },
            {
                id: "c3",
                title: "Docs",
                updatedAtMs: 400,
                directory: "C:\\work\\docs",
            },
            {
                id: "c4",
                title: "Empty",
                updatedAtMs: 500,
                directory: "",
            },
        ],
    });
});

afterEach(() => {
    const { result } = renderHook(() => useSessionDirectory());
    act(() => {
        result.current.selectDirectory(undefined);
    });
    localStorage.clear();
});

it.each([
    ["a bound session", "c1", "C:\\work\\project"],
    ["a session in a generated workspace", "c2", undefined],
    ["an unlisted session", "c9", undefined],
    ["no session", null, undefined],
])("reads the directory of %s", (_case, id, directory) => {
    const { result } = renderHook(() => useSessionDirectory(id));

    expect(result.current.directory).toBe(directory);
});

it("merges stored recent directories with unique session directories", () => {
    localStorage.setItem(
        "lemma.recentDirectories",
        JSON.stringify([
            "C:\\work\\stored",
            "C:\\work\\docs",
            "",
            123,
            "C:\\work\\stored",
        ]),
    );

    const { result } = renderHook(() => useSessionDirectory());

    expect(result.current.directory).toBeUndefined();
    expect(result.current.recentDirectories).toEqual([
        "C:\\work\\stored",
        "C:\\work\\docs",
        "C:\\work\\project",
    ]);
});

it.each([
    ["malformed JSON", "{not-json"],
    ["non-array JSON", JSON.stringify({ dir: "C:\\work\\a" })],
])("ignores %s in localStorage", (_case, raw) => {
    localStorage.setItem("lemma.recentDirectories", raw);

    const { result } = renderHook(() => useSessionDirectory());

    expect(result.current.recentDirectories).toEqual([
        "C:\\work\\docs",
        "C:\\work\\project",
    ]);
});

it("selects, clears, deduplicates, and caps recent directories", () => {
    const { result } = renderHook(() => useSessionDirectory());

    for (let i = 1; i <= 9; i++) {
        act(() => {
            result.current.selectDirectory(`/work/dir-${i}`);
        });
    }

    expect(result.current.directory).toBe("/work/dir-9");
    const raw = localStorage.getItem("lemma.recentDirectories");
    expect(raw).not.toBeNull();
    const stored: unknown = JSON.parse(String(raw));
    expect(stored).toEqual([
        "/work/dir-9",
        "/work/dir-8",
        "/work/dir-7",
        "/work/dir-6",
        "/work/dir-5",
        "/work/dir-4",
        "/work/dir-3",
        "/work/dir-2",
    ]);
    act(() => {
        result.current.selectDirectory("/work/dir-5");
    });
    expect(result.current.recentDirectories[0]).toBe("/work/dir-5");

    act(() => {
        result.current.selectDirectory("");
    });
    expect(result.current.directory).toBeUndefined();

    act(() => {
        result.current.selectDirectory(undefined);
    });
    expect(result.current.directory).toBeUndefined();
});

it("shares selected directory across separate hook callers", () => {
    const first = renderHook(() => useSessionDirectory());
    const second = renderHook(() => useSessionDirectory());

    act(() => {
        first.result.current.selectDirectory("/work/shared");
    });

    expect(second.result.current.directory).toBe("/work/shared");
    expect(second.result.current.recentDirectories[0]).toBe("/work/shared");
});

it("picks a directory via the platform picker when available", async () => {
    const { result: unavailable } = renderHook(() => useSessionDirectory());
    expect(unavailable.current.canPickDirectory).toBe(false);
    await expect(unavailable.current.pickDirectory()).resolves.toBeUndefined();

    const pick = vi
        .fn<() => Promise<string | null>>()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("")
        .mockResolvedValueOnce("/work/picked");
    platform.directoryPicker = { pick };

    const { result } = renderHook(() => useSessionDirectory());
    expect(result.current.canPickDirectory).toBe(true);

    let first: string | undefined;
    await act(async () => {
        first = await result.current.pickDirectory();
    });
    expect(first).toBeUndefined();
    expect(result.current.directory).toBeUndefined();

    let second: string | undefined;
    await act(async () => {
        second = await result.current.pickDirectory();
    });
    expect(second).toBeUndefined();
    expect(result.current.directory).toBeUndefined();

    let third: string | undefined;
    await act(async () => {
        third = await result.current.pickDirectory();
    });
    expect(third).toBe("/work/picked");
    expect(result.current.directory).toBe("/work/picked");
    expect(result.current.recentDirectories[0]).toBe("/work/picked");
});
