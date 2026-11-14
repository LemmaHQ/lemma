import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { useStoredSidebar } from "./useStoredSidebar";

afterEach(() => {
    localStorage.clear();
});

it("starts open by default and reads collapsed state from storage", () => {
    expect(renderHook(() => useStoredSidebar()).result.current.open).toBe(true);

    localStorage.setItem("lemma.sidebarCollapsed", "1");
    expect(renderHook(() => useStoredSidebar()).result.current.open).toBe(
        false,
    );
});

it("persists open and collapsed toggles in storage", () => {
    const { result } = renderHook(() => useStoredSidebar());

    act(() => {
        result.current.storeOpen(false);
    });
    expect(result.current.open).toBe(false);
    expect(localStorage.getItem("lemma.sidebarCollapsed")).toBe("1");

    act(() => {
        result.current.storeOpen(true);
    });
    expect(result.current.open).toBe(true);
    expect(localStorage.getItem("lemma.sidebarCollapsed")).toBe("0");
});
