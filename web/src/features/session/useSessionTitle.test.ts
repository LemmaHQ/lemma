import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";

import { useSessionStore } from "./store";
import { useSessionTitle } from "./useSessionTitle";

beforeEach(() => {
    useSessionStore.setState({
        list: [{ id: "c1", title: "Trip plans", updatedAtMs: 0 }],
    });
});

it.each([
    ["a listed session", "c1", "Trip plans"],
    ["an unlisted session", "c9", undefined],
    ["no session", null, undefined],
])("reads the title of %s", (_case, id, title) => {
    const { result } = renderHook(() => useSessionTitle(id));

    expect(result.current).toBe(title);
});
