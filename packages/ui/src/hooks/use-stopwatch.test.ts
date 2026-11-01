import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useStopwatch } from "./use-stopwatch";

const START = 1_000_000;

beforeEach(() => {
    vi.useFakeTimers({ now: START });
});

afterEach(() => {
    vi.useRealTimers();
});

it("reports nothing before the interval starts", () => {
    const { result } = renderHook(() => useStopwatch());

    expect(result.current).toBeUndefined();
});

it("ticks while running and freezes at the finish", () => {
    const { result, rerender } = renderHook(
        ({ finishedAt }: { finishedAt?: number }) =>
            useStopwatch(START, finishedAt),
        { initialProps: {} },
    );
    expect(result.current).toBe(0);

    act(() => {
        vi.advanceTimersByTime(1200);
    });
    expect(result.current).toBe(1200);

    rerender({ finishedAt: START + 1500 });
    act(() => {
        vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(1500);
});

it("never reports a negative duration", () => {
    const { result } = renderHook(() => useStopwatch(START + 500, START));

    expect(result.current).toBe(0);
});
