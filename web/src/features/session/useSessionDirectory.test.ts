import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";

import { useSessionStore } from "./store";
import { useSessionDirectory } from "./useSessionDirectory";

beforeEach(() => {
    useSessionStore.setState({
        list: [
            {
                id: "c1",
                title: "Project",
                updatedAtMs: 0,
                directory: "C:\\work\\project",
            },
            { id: "c2", title: "Scratch", updatedAtMs: 0 },
        ],
    });
});

it.each([
    ["a bound session", "c1", "C:\\work\\project"],
    ["a session in a generated workspace", "c2", undefined],
    ["an unlisted session", "c9", undefined],
    ["no session", null, undefined],
])("reads the directory of %s", (_case, id, directory) => {
    const { result } = renderHook(() => useSessionDirectory(id));

    expect(result.current).toBe(directory);
});
