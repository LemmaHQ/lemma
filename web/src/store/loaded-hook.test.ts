import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createStore } from "zustand";

import { createLoadedHook, singleFlight } from "./loaded-hook";

describe("singleFlight", () => {
    it("deduplicates concurrent calls and allows subsequent calls after settling", async () => {
        const first = Promise.withResolvers<undefined>();
        const second = Promise.withResolvers<undefined>();
        const task = vi
            .fn<() => Promise<void>>()
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const run = singleFlight(task);

        const a = run();
        const b = run();
        expect(a).toBe(b);
        expect(task).toHaveBeenCalledTimes(1);

        first.resolve(undefined);
        await Promise.all([a, b]);

        const c = run();
        expect(task).toHaveBeenCalledTimes(2);
        second.resolve(undefined);
        await c;
    });

    it("clears the in-flight slot on failure so callers can retry", async () => {
        const failed = Promise.withResolvers<undefined>();
        const task = vi
            .fn<() => Promise<void>>()
            .mockReturnValueOnce(failed.promise)
            .mockResolvedValueOnce();
        const run = singleFlight(task);

        const a = run();
        const b = run();
        failed.reject(new Error("boom"));

        await expect(a).rejects.toThrow("boom");
        await expect(b).rejects.toThrow("boom");

        await expect(run()).resolves.toBeUndefined();
        expect(task).toHaveBeenCalledTimes(2);
    });
});

describe("createLoadedHook", () => {
    it("triggers refresh once on mount when unloaded and skips when already loaded", async () => {
        const list = Promise.withResolvers<string[]>();
        const fetchList = vi
            .fn<() => Promise<string[]>>()
            .mockReturnValueOnce(list.promise);
        const store = createStore<{
            items: string[];
            loaded: boolean;
            refresh: () => Promise<void>;
        }>()((set) => ({
            items: [],
            loaded: false,
            refresh: singleFlight(async () => {
                const items = await fetchList();
                set({ items, loaded: true });
            }),
        }));
        const useTestItems = createLoadedHook(store);

        const first = renderHook(() => useTestItems((s) => s.items));
        const second = renderHook(() => useTestItems());

        expect(fetchList).toHaveBeenCalledTimes(1);
        list.resolve(["a"]);

        await waitFor(() => {
            expect(first.result.current).toEqual(["a"]);
            expect(second.result.current.loaded).toBe(true);
        });

        const third = renderHook(() => useTestItems((s) => s.items));
        expect(third.result.current).toEqual(["a"]);
        expect(fetchList).toHaveBeenCalledTimes(1);
    });
});
