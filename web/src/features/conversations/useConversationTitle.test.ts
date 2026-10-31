import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";

import { useConversationsStore } from "./store";
import { useConversationTitle } from "./useConversationTitle";

beforeEach(() => {
    useConversationsStore.setState({
        list: [{ id: "c1", title: "Trip plans", updatedAtMs: 0 }],
    });
});

it.each([
    ["a listed conversation", "c1", "Trip plans"],
    ["an unlisted conversation", "c9", undefined],
    ["no conversation", null, undefined],
])("reads the title of %s", (_case, id, title) => {
    const { result } = renderHook(() => useConversationTitle(id));

    expect(result.current).toBe(title);
});
