import { expect, it } from "vitest";

import { connectionPatch, isBaseUrlValid } from "./connection";

it.each([
    ["https://api.example.com/v1", true],
    ["  http://localhost:8080  ", true],
    ["ftp://api.example.com", false],
    ["api.example.com", false],
    ["https://", false],
])("judges %j as a base URL", (url, valid) => {
    expect(isBaseUrlValid(url)).toBe(valid);
});

it("patches only non-blank keys and trimmed fields that changed", () => {
    const saved = {
        baseUrl: "https://a.example.com",
        apiPath: "",
    };

    expect(connectionPatch({ apiKey: "", ...saved }, saved)).toEqual({});
    expect(
        connectionPatch(
            {
                apiKey: "   ",
                baseUrl: "https://b.example.com ",
                apiPath: " /v2/chat ",
            },
            saved,
        ),
    ).toEqual({ baseUrl: "https://b.example.com", apiPath: "/v2/chat" });
    expect(connectionPatch({ ...saved, apiKey: " sk-2 " }, saved)).toEqual({
        apiKey: "sk-2",
    });
});
