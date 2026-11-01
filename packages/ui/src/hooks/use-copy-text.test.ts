import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useCopyText } from "./use-copy-text";

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const copy = async (text: string) => {
    const { result } = renderHook(() => useCopyText());
    await act(async () => {
        result.current.copy(text);
        await Promise.resolve();
    });
    return result;
};

it("reports a copy for 1.5 seconds", async () => {
    const writeText = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockResolvedValue();

    const result = await copy("hello");
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(result.current.copied).toBe(true);

    act(() => {
        vi.advanceTimersByTime(1499);
    });
    expect(result.current.copied).toBe(true);
    act(() => {
        vi.advanceTimersByTime(1);
    });
    expect(result.current.copied).toBe(false);
});

it("stays uncopied when the clipboard rejects", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
        new Error("denied"),
    );

    const result = await copy("hello");

    expect(result.current.copied).toBe(false);
});
