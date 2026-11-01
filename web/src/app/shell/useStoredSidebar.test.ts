import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { useStoredSidebar } from "./useStoredSidebar";

afterEach(() => {
    localStorage.clear();
});

it("starts open at the default width", () => {
    const { result } = renderHook(() => useStoredSidebar());

    expect(result.current.open).toBe(true);
    expect(result.current.width).toBeNull();
});

it("restores a stored width and ignores one that is not positive", () => {
    localStorage.setItem("sidebar-width", "320");
    expect(renderHook(() => useStoredSidebar()).result.current.width).toBe(320);

    localStorage.setItem("sidebar-width", "0");
    expect(
        renderHook(() => useStoredSidebar()).result.current.width,
    ).toBeNull();
});

it("stores a dragged width and forgets it on reset", () => {
    const { result } = renderHook(() => useStoredSidebar());

    act(() => {
        result.current.storeWidth(288);
    });
    expect(result.current.width).toBe(288);
    expect(localStorage.getItem("sidebar-width")).toBe("288");

    act(() => {
        result.current.storeWidth(null);
    });
    expect(result.current.width).toBeNull();
    expect(localStorage.getItem("sidebar-width")).toBeNull();
});
