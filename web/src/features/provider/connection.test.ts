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

it("patches only the trimmed fields that changed", () => {
    const saved = {
        apiKey: "sk-1",
        baseUrl: "https://a.example.com",
        apiPath: "",
    };

    expect(connectionPatch(saved, saved)).toEqual({});
    expect(
        connectionPatch(
            {
                apiKey: " sk-1 ",
                baseUrl: "https://b.example.com ",
                apiPath: " /v2/chat ",
            },
            saved,
        ),
    ).toEqual({ baseUrl: "https://b.example.com", apiPath: "/v2/chat" });
    expect(connectionPatch({ ...saved, apiKey: "sk-2" }, saved)).toEqual({
        apiKey: "sk-2",
    });
});
