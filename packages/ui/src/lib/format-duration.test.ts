import { expect, it } from "vitest";

import { formatDuration } from "./format-duration";

it.each([
    [0, false, "1ms"],
    [0.4, false, "1ms"],
    [420, false, "420ms"],
    [999, false, "999ms"],
    [420, true, "0.4s"],
    [1000, false, "1.0s"],
    [12_345, false, "12.3s"],
    [59_999, false, "59.9s"],
    [60_000, false, "1m 00s"],
    [125_400, true, "2m 05s"],
])("formats %d ms (live: %s) as %s", (ms, live, text) => {
    expect(formatDuration(ms, live)).toBe(text);
});

it("formats a finished duration by default", () => {
    expect(formatDuration(250)).toBe("250ms");
});
