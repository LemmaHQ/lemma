import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { type ModelOption, useModelSelection } from "./useModelSelection";

const options: ModelOption[] = [
    { providerId: "p1", model: "m1", providerName: "One" },
    { providerId: "p2", model: "m2", providerName: "Two" },
];

afterEach(() => {
    localStorage.clear();
});

it("offers the first model when nothing is stored", () => {
    const { result } = renderHook(() => useModelSelection(options));

    expect(result.current.model).toEqual({ providerId: "p1", model: "m1" });
});

it("offers no model without options", () => {
    const { result } = renderHook(() => useModelSelection([]));

    expect(result.current.model).toBeNull();
});

it("keeps a choice across mounts while the options offer it", () => {
    const first = renderHook(() => useModelSelection(options));
    act(() => {
        first.result.current.selectModel({ providerId: "p2", model: "m2" });
    });
    expect(first.result.current.model).toEqual({
        providerId: "p2",
        model: "m2",
    });

    const second = renderHook(() => useModelSelection(options));
    expect(second.result.current.model).toEqual({
        providerId: "p2",
        model: "m2",
    });
});

it("falls back to the first option when the stored model is gone", () => {
    localStorage.setItem(
        "lemma.model",
        JSON.stringify({ providerId: "p3", model: "m3" }),
    );

    const { result } = renderHook(() => useModelSelection(options));

    expect(result.current.model).toEqual({ providerId: "p1", model: "m1" });
});

it.each([
    ["malformed JSON", "{"],
    ["a non-object", '"p2/m2"'],
    ["an empty model", JSON.stringify({ providerId: "p2", model: "" })],
    ["an empty provider", JSON.stringify({ providerId: "", model: "m2" })],
    ["a missing model", JSON.stringify({ providerId: "p2" })],
])("ignores a stored choice with %s", (_case, raw) => {
    localStorage.setItem("lemma.model", raw);

    const { result } = renderHook(() => useModelSelection(options));

    expect(result.current.model).toEqual({ providerId: "p1", model: "m1" });
});
