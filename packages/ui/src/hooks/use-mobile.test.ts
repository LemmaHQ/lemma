import { act, renderHook } from "@testing-library/react";
import type { Window as HappyWindow } from "happy-dom";
import { afterEach, expect, it } from "vitest";

import { useIsMobile } from "./use-mobile";

const setViewportWidth = (width: number) => {
    act(() => {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- vitest's happy-dom environment adds the happyDOM API to window without typing it
        (window as unknown as HappyWindow).happyDOM.setViewport({ width });
    });
};

afterEach(() => {
    setViewportWidth(1024);
});

it("follows the viewport across the md breakpoint", () => {
    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    setViewportWidth(767);
    expect(result.current).toBe(true);

    setViewportWidth(768);
    expect(result.current).toBe(false);
    unmount();
});
