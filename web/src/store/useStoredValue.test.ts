import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { type StoredCodec, useStoredValue } from "./useStoredValue";

const listCodec: StoredCodec<string[]> = {
    parse: (raw) => {
        if (raw === null) {
            return [];
        }
        try {
            const parsed: unknown = JSON.parse(raw);
            return Array.isArray(parsed)
                ? parsed.filter(
                      (item): item is string => typeof item === "string",
                  )
                : [];
        } catch {
            return [];
        }
    },
    serialize: (value) => JSON.stringify(value),
};

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

it("keeps snapshot identity across renders and syncs multiple callers and storage events", () => {
    const first = renderHook(() => useStoredValue("lemma.items", listCodec));
    const second = renderHook(() => useStoredValue("lemma.items", listCodec));

    const initialRef = first.result.current[0];
    first.rerender();
    expect(first.result.current[0]).toBe(initialRef);

    act(() => {
        first.result.current[1](["alpha", "beta"]);
    });
    expect(first.result.current[0]).toEqual(["alpha", "beta"]);
    expect(second.result.current[0]).toEqual(["alpha", "beta"]);

    act(() => {
        localStorage.setItem("lemma.items", JSON.stringify(["remote"]));
        window.dispatchEvent(
            new StorageEvent("storage", { key: "lemma.items" }),
        );
    });
    expect(second.result.current[0]).toEqual(["remote"]);

    act(() => {
        window.dispatchEvent(
            new StorageEvent("storage", { key: "lemma.other" }),
        );
        localStorage.clear();
        window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(first.result.current[0]).toEqual([]);

    first.unmount();
    second.unmount();
});

it("falls back cleanly when localStorage throws", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
    });

    const { result } = renderHook(() =>
        useStoredValue("lemma.items", listCodec),
    );
    expect(result.current[0]).toEqual([]);

    act(() => {
        result.current[1](["in-memory"]);
    });
    expect(result.current[0]).toEqual([]);
});
